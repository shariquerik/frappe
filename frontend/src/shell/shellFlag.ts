// The prototype's switch. `?shell=frappe-ui` on any address turns frappe-ui's shell components
// on for this browser and `?shell=default` turns them off; the choice is kept in localStorage.

const KEY = "frappe:desk:shell";

export function usesFrappeUiShell(): boolean {
	try {
		const asked = new URLSearchParams(location.search).get("shell");
		if (asked === "frappe-ui") localStorage.setItem(KEY, asked);
		if (asked === "default") localStorage.removeItem(KEY);
		return localStorage.getItem(KEY) === "frappe-ui";
	} catch {
		return false;
	}
}
