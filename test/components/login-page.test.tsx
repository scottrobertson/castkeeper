import { describe, it, expect } from "vitest";
import { LoginPage } from "../../src/components/LoginPage";

function render(error?: string): string {
  return (<LoginPage error={error} />).toString();
}

describe("LoginPage", () => {
  it("renders the login form", () => {
    const html = render();
    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/login"');
  });

  it("includes a password input field", () => {
    const html = render();
    expect(html).toContain('type="password"');
    expect(html).toContain('name="password"');
  });

  it("includes a submit button with Log in text", () => {
    const html = render();
    expect(html).toContain("Log in");
  });

  it("shows the Castkeeper heading", () => {
    const html = render();
    expect(html).toContain("Castkeeper");
  });

  it("has the correct page title", () => {
    const html = render();
    expect(html).toContain("<title>Castkeeper — Login</title>");
  });

  it("does not show an error paragraph when no error is provided", () => {
    const noError = render();
    const withError = render("Something went wrong");
    // The error message only appears when the prop is passed
    expect(noError).not.toContain("Something went wrong");
    expect(withError).toContain("Something went wrong");
  });

  it("shows the error message when error is provided", () => {
    const html = render("Invalid password");
    expect(html).toContain("Invalid password");
  });

  it("escapes HTML in the error message", () => {
    const html = render("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
