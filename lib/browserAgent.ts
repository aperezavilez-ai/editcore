import { chromium } from "playwright";

export interface BrowseResult {
  url: string;
  title: string;
  text: string;
  links: { text: string; href: string }[];
  screenshot_base64?: string;
  error?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";

function launchBrowser() {
  return chromium.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
}

/** Navega a una URL y extrae titulo, texto legible y links */
export async function browseUrl(url: string, takeScreenshot = false): Promise<BrowseResult> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "es,en;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    const title = await page.title();

    // Extraer texto legible — elimina scripts, estilos y nav
    const text = await page.evaluate(() => {
      const remove = document.querySelectorAll("script,style,nav,footer,header,aside,noscript");
      remove.forEach(el => el.remove());
      return (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 8000);
    });

    // Extraer links utiles
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({ text: (a as HTMLAnchorElement).innerText.trim(), href: (a as HTMLAnchorElement).href }))
        .filter(l => l.text && l.href.startsWith("http"))
        .slice(0, 20);
    });

    let screenshot_base64: string | undefined;
    if (takeScreenshot) {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      screenshot_base64 = buf.toString("base64");
    }

    return { url, title, text, links, screenshot_base64 };
  } catch (err: any) {
    return { url, title: "", text: "", links: [], error: err.message };
  } finally {
    await browser.close();
  }
}

/** Busca en DuckDuckGo y devuelve los primeros resultados */
export async function searchWeb(query: string, maxResults = 8): Promise<SearchResult[]> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    const results = await page.evaluate((max: number) => {
      const items = Array.from(document.querySelectorAll(".result__body, .result")).slice(0, max);
      return items.map(item => {
        const titleEl = item.querySelector(".result__title a, .result__a");
        const snippetEl = item.querySelector(".result__snippet");
        const title = (titleEl as HTMLElement)?.innerText?.trim() || "";
        const href = (titleEl as HTMLAnchorElement)?.href || "";
        const snippet = (snippetEl as HTMLElement)?.innerText?.trim() || "";
        return { title, url: href, snippet };
      }).filter(r => r.title && r.url);
    }, maxResults);

    return results;
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}

/** Extrae el contenido principal de multiples URLs en paralelo */
export async function browseMultiple(urls: string[]): Promise<BrowseResult[]> {
  return Promise.all(urls.slice(0, 5).map(url => browseUrl(url, false)));
}
