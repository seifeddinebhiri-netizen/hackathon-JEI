import asyncio

import httpx
import pytest

from app.services.research import fetcher
from app.services.research.browser import BrowserReader, BrowserUnavailable, request_allowed
from app.services.research.fetcher import (
    FetchBlocked,
    FetchError,
    FetchUnreachable,
    Page,
    clear_robots_cache,
    fetch_page,
)
from app.services.research.reader import PageReader

LONG = (
    "<html><body><p>"
    + "Terms of service and acceptable use of the product. " * 20
    + "</p></body></html>"
)
SHELL = "<html><body><div id='root'></div><script>app()</script></body></html>"


@pytest.fixture(autouse=True)
def public_hosts(monkeypatch):
    """Les faux sites de test n'existent pas dans le DNS : on les déclare publics."""
    monkeypatch.setattr(fetcher, "_is_public", lambda _host: True)
    clear_robots_cache()
    yield
    clear_robots_cache()


def client(routes: dict[str, httpx.Response], log: list[str] | None = None) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if log is not None:
            log.append(str(request.url))
        return routes.get(str(request.url), httpx.Response(404, text="not found"))

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)


def html(body: str, status: int = 200, **headers) -> httpx.Response:
    return httpx.Response(status, text=body, headers={"content-type": "text/html", **headers})


def read(url: str, routes, log=None, robots=True) -> Page:
    return asyncio.run(fetch_page(url, client(routes, log), respect_robots=robots))


# --- robots.txt -------------------------------------------------------------------------------
def test_a_page_the_site_forbids_to_robots_is_not_read():
    routes = {
        "https://a.example/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /private\n", headers={"content-type": "text/plain"}),
        "https://a.example/private/terms": html(LONG),
        "https://a.example/public/terms": html(LONG),
    }  # fmt: skip
    with pytest.raises(FetchBlocked, match="robots.txt"):
        read("https://a.example/private/terms", routes)
    assert "Terms of service" in read("https://a.example/public/terms", routes).text


def test_a_robots_file_behind_a_redirect_is_still_respected():
    routes = {
        "https://a.example/robots.txt": httpx.Response(301, headers={"location": "https://www.a.example/robots.txt"}),
        "https://www.a.example/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /\n", headers={"content-type": "text/plain"}),
        "https://a.example/terms": html(LONG),
    }  # fmt: skip
    with pytest.raises(FetchBlocked, match="robots.txt"):
        read("https://a.example/terms", routes)


def test_a_rule_aimed_at_our_robot_by_name_is_respected():
    routes = {
        "https://a.example/robots.txt": httpx.Response(200, text="User-agent: PremierPlanBot\nDisallow: /\n", headers={"content-type": "text/plain"}),
        "https://a.example/terms": html(LONG),
    }  # fmt: skip
    with pytest.raises(FetchBlocked):
        read("https://a.example/terms", routes)


def test_no_robots_file_or_an_html_error_page_means_allowed_and_it_is_asked_once():
    log: list[str] = []
    routes = {
        "https://a.example/robots.txt": html("<html>Page not found</html>"),
        "https://a.example/a": html(LONG),
        "https://a.example/b": html(LONG + " b"),
    }
    c = client(routes, log)
    asyncio.run(fetch_page("https://a.example/a", c))
    asyncio.run(fetch_page("https://a.example/b", c))
    assert log.count("https://a.example/robots.txt") == 1  # mis en cache pour l'heure


def test_robots_can_be_skipped_only_when_explicitly_asked():
    routes = {"https://a.example/robots.txt": httpx.Response(200, text="User-agent: *\nDisallow: /\n", headers={"content-type": "text/plain"}), "https://a.example/t": html(LONG)}  # fmt: skip
    assert read("https://a.example/t", routes, robots=False).text


# --- refus et erreurs ---------------------------------------------------------------------------
@pytest.mark.parametrize("status", [401, 403, 429])
def test_a_refusal_is_reported_as_blocked_not_as_missing(status):
    with pytest.raises(FetchBlocked, match=str(status)):
        read("https://a.example/t", {"https://a.example/t": httpx.Response(status)})


def test_a_missing_page_is_not_a_block():
    with pytest.raises(FetchError) as exc:
        read("https://a.example/t", {})
    assert not isinstance(exc.value, FetchBlocked)


def test_the_page_keeps_its_html_for_link_discovery_and_its_final_address():
    routes = {
        "https://a.example/old": httpx.Response(301, headers={"location": "https://a.example/new"}),
        "https://a.example/new": html('<a href="/legal/terms">Terms</a>' + LONG),
    }
    page = read("https://a.example/old", routes)
    assert page.url == "https://a.example/new" and 'href="/legal/terms"' in page.html


def test_a_redirect_to_a_private_address_is_refused(monkeypatch):
    monkeypatch.setattr(fetcher, "_is_public", lambda host: host != "internal.example")
    routes = {
        "https://a.example/x": httpx.Response(
            302, headers={"location": "https://internal.example/secret"}
        )
    }
    with pytest.raises(FetchError, match="non publique"):
        read("https://a.example/x", routes)


# --- le lecteur : navigateur seulement pour une coquille, jamais après un refus ---------------------
class FakeBrowser:
    def __init__(
        self, text="Rendered terms of service text. " * 20, error: Exception | None = None
    ):
        self.text, self.error, self.calls = text, error, []

    async def render(self, url: str) -> Page:
        self.calls.append(url)
        if self.error:
            raise self.error
        return Page(url=url, html="", text=self.text)


def reader_for(monkeypatch, pages: dict[str, object], browser=None) -> PageReader:
    async def fake_fetch(url: str, *a, **k) -> Page:
        value = pages[url]
        if isinstance(value, Exception):
            raise value
        return value

    monkeypatch.setattr("app.services.research.reader.fetch_page", fake_fetch)
    return PageReader(browser)


def test_a_normal_page_is_never_sent_to_the_browser(monkeypatch):
    browser = FakeBrowser()
    page = Page(url="https://a.example/t", html=LONG, text="Terms. " * 100)
    r = reader_for(monkeypatch, {"https://a.example/t": page}, browser)
    assert asyncio.run(r("https://a.example/t")) is page and browser.calls == []


def test_a_javascript_shell_is_rendered_by_the_browser(monkeypatch):
    browser = FakeBrowser()
    shell = Page(url="https://a.example/t", html=SHELL, text="")
    out = asyncio.run(
        reader_for(monkeypatch, {"https://a.example/t": shell}, browser)("https://a.example/t")
    )
    assert out.text.startswith("Rendered terms") and browser.calls == ["https://a.example/t"]


def test_after_a_refusal_the_browser_is_never_tried(monkeypatch):
    browser = FakeBrowser()
    r = reader_for(monkeypatch, {"https://a.example/t": FetchBlocked("HTTP 403")}, browser)
    with pytest.raises(FetchBlocked):
        asyncio.run(r("https://a.example/t"))
    assert browser.calls == []  # pas de détour pour passer outre un refus


def test_without_a_browser_a_shell_is_returned_as_is(monkeypatch):
    shell = Page(url="https://a.example/t", html=SHELL, text="")
    assert (
        asyncio.run(reader_for(monkeypatch, {"https://a.example/t": shell})("https://a.example/t"))
        is shell
    )


def test_a_missing_or_failing_browser_degrades_to_the_plain_page(monkeypatch):
    shell = Page(url="https://a.example/t", html=SHELL, text="")
    for error in (BrowserUnavailable("pas installé"), FetchError("navigateur : TimeoutError")):
        r = reader_for(monkeypatch, {"https://a.example/t": shell}, FakeBrowser(error=error))
        assert asyncio.run(r("https://a.example/t")) is shell


def test_a_browser_that_finds_less_than_the_plain_page_does_not_replace_it(monkeypatch):
    thin = Page(url="https://a.example/t", html=SHELL, text="Cookies")
    r = reader_for(monkeypatch, {"https://a.example/t": thin}, FakeBrowser(text=""))
    assert asyncio.run(r("https://a.example/t")) is thin


# --- ce que la page lue a le droit de demander au navigateur -----------------------------------------
def test_a_page_cannot_make_the_browser_reach_internal_addresses(monkeypatch):
    monkeypatch.setattr(fetcher, "_is_public", lambda host: host != "internal.example")
    assert request_allowed("https://cdn.example/app.js", "script")
    assert not request_allowed("https://internal.example/admin", "xhr")  # adresse privée
    assert not request_allowed("http://cdn.example/app.js", "script")  # pas de http
    assert not request_allowed("https://cdn.example:8443/x", "fetch")  # port inhabituel
    assert not request_allowed(
        "https://cdn.example/logo.png", "image"
    )  # inutile pour lire du texte
    assert not request_allowed("https://cdn.example/f.woff2", "font")
    assert not request_allowed("file:///etc/passwd", "document")


def test_the_browser_refuses_unsafe_start_addresses_before_launching_anything():
    reader = BrowserReader()
    with pytest.raises(FetchError):
        asyncio.run(reader.render("http://127.0.0.1/admin"))
    assert reader._browser is None  # rien n'a été lancé


# --- site injoignable : la raison est dite, pas seulement « ConnectError » ----------------------
def failing_client(error: Exception) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        raise error

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed", "certificat HTTPS invalide"),
        ("[Errno 8] nodename nor servname provided, or not known", "domaine introuvable"),
        ("All connection attempts failed", "connexion impossible"),
    ],
)
def test_an_unreachable_site_says_why(message, expected):
    with pytest.raises(FetchUnreachable, match=expected):
        asyncio.run(
            fetch_page(
                "https://a.example/t",
                failing_client(httpx.ConnectError(message)),
                respect_robots=False,
            )
        )


def test_a_timeout_is_not_reported_as_an_unreachable_site():
    with pytest.raises(FetchError) as exc:
        asyncio.run(
            fetch_page(
                "https://a.example/t",
                failing_client(httpx.ReadTimeout("slow")),
                respect_robots=False,
            )
        )
    assert not isinstance(exc.value, FetchUnreachable) and "ReadTimeout" in str(exc.value)


def test_a_domain_that_does_not_exist_is_reported_as_such(monkeypatch):
    monkeypatch.undo()  # retire la fausse « résolution publique » du fichier : on veut le vrai DNS

    def no_such_host(*_a, **_k):
        raise OSError("Name or service not known")

    monkeypatch.setattr(fetcher.socket, "getaddrinfo", no_such_host)
    with pytest.raises(FetchUnreachable, match="domaine introuvable"):
        fetcher.check_url("https://nope.example/x")
