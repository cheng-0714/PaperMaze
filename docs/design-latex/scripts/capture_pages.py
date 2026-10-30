"""Reproduce report screenshots through real UI actions (no DOM/state mutation).
Run: python docs/design-latex/scripts/capture_pages.py
Requires: pip install playwright; a running app at http://127.0.0.1:8000.
Uses installed Edge; captures a 1920x1080 viewport at device scale factor 2.
The BFS operation saves one genuine unreachable run in the application's history.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


def full_page(page, filename):
    # Trigger the app's own IntersectionObserver reveal effects, without editing DOM.
    height = page.evaluate("document.documentElement.scrollHeight")
    for y in range(0, height, 600):
        page.evaluate("y => window.scrollTo(0, y)", y)
        page.wait_for_timeout(180)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(ROOT / "images" / filename), full_page=True)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE, headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        page.get_by_role("button", name="打开石阵密匙", exact=True).click()
        page.locator(".settings-form select").select_option("11")
        page.locator(".settings-form input[type=number]").fill("123")
        page.get_by_role("button", name="绘制舆图", exact=False).click()
        page.evaluate("document.fonts.ready")
        page.locator("img.landscape").evaluate("img => img.decode()")
        full_page(page, "00-整体页面.png")

        page.get_by_role("button", name="立石", exact=True).click()
        svg = page.locator("svg.maze")
        # The goal of this generated map is (9,9). Close both interior neighbors.
        for row, col in [(8, 9), (9, 8)]:
            point = svg.evaluate("""(svg, cell) => {
                const point = svg.createSVGPoint();
                point.x = (cell.col + .5) * 24; point.y = (cell.row + .5) * 24;
                const screen = point.matrixTransform(svg.getScreenCTM());
                return {x: screen.x, y: screen.y};
            }""", {"row": row, "col": col})
            page.mouse.click(point["x"], point["y"])
        page.get_by_role("button", name="移步", exact=True).click()
        with page.expect_response(lambda r: r.url.endswith("/api/runs") and r.request.method == "POST") as saved:
            page.locator(".algorithm-choices button").filter(has_text="BFS").click()
        response = saved.value
        assert response.ok, response.status
        run = response.json()
        assert run["mode"] == "bfs" and run["found"] is False and run["path"] == []
        maze = run["maze"]
        assert maze["goal"] == {"row": 9, "col": 9} and maze["edited"]
        assert all(maze["cells"][r][c] == 1 for r, c in [(8, 9), (9, 8), (10, 9), (9, 10)])
        assert maze["cells"][9][9] == 0
        page.wait_for_function("document.querySelector('.status').textContent.includes('无解')")
        page.wait_for_function("Number(document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')) === Number(document.querySelector('[role=progressbar]').getAttribute('aria-valuemax'))")
        assert page.locator(".comparison-table").inner_text().count("无解") == 1
        assert page.locator("svg.maze .goal").is_visible()
        full_page(page, "04-无解提示.png")
        assert not errors, errors
        evidence = {
            "url": page.url, "viewport": {"width": 1920, "height": 1080}, "deviceScaleFactor": 2,
            "seed": 123, "size": 11, "runId": run["id"], "mode": run["mode"],
            "goal": maze["goal"], "blockedNeighbors": [[8, 9], [9, 8], [10, 9], [9, 10]],
            "found": run["found"], "path": run["path"], "visitedNodes": len(run["visitedOrder"]),
            "status": page.locator(".status").inner_text(), "pageErrors": errors,
        }
        (ROOT / "scripts" / "capture_evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(evidence, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
