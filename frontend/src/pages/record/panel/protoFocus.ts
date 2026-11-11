// PROTOTYPE (#46965), throwaway: which focused-row look the panel draws.
// `?focus=a` is the hover fill plus an inset ring; `?focus=b` is a white fill plus a ring.
// `?ring=3|4` picks the ring tone (outline-gray-3 or outline-gray-4).
import { ref } from "vue";

const query = () => new URLSearchParams(location.search);

export const protoFocus = ref<"a" | "b">(query().get("focus") === "b" ? "b" : "a");
export const protoRing = ref<"3" | "4">(query().get("ring") === "4" ? "4" : "3");

export function setProto(key: "focus" | "ring", value: string) {
	const url = new URL(location.href);
	url.searchParams.set(key, value);
	history.replaceState(history.state, "", url);
	if (key === "focus") protoFocus.value = value as "a" | "b";
	else protoRing.value = value as "3" | "4";
}
