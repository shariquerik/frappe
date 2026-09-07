// The prototype's switch. Set `localStorage["frappe:desk:shell"] = "frappe-ui"` and reload to
// draw the frame with frappe-ui's shell components; unset, today's hand-drawn frame draws.

const KEY = "frappe:desk:shell";

export function usesFrappeUiShell(): boolean {
	try {
		return localStorage.getItem(KEY) === "frappe-ui";
	} catch {
		return false;
	}
}
