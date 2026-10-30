// PROTOTYPE (#45867): the data fieldtypes the editor offers, grouped, with an icon each.
export const FIELDTYPES = [
	{ label: "Text", types: ["Data", "Small Text", "Text", "Long Text", "Text Editor", "Markdown Editor", "Code", "Password", "Phone"] },
	{ label: "Number", types: ["Int", "Float", "Currency", "Percent", "Rating", "Duration"] },
	{ label: "Choice", types: ["Check", "Select", "Autocomplete", "Color"] },
	{ label: "Date and time", types: ["Date", "Datetime", "Time"] },
	{ label: "Links and tables", types: ["Link", "Dynamic Link", "Table", "Table MultiSelect"] },
	{ label: "Files and other", types: ["Attach", "Attach Image", "Signature", "Geolocation", "JSON", "Button", "Read Only", "HTML", "Barcode", "Icon"] },
];

const ICONS: Record<string, string> = {
	Data: "lucide-type", "Small Text": "lucide-text", Text: "lucide-text", "Long Text": "lucide-text",
	"Text Editor": "lucide-pilcrow", "Markdown Editor": "lucide-pilcrow", Code: "lucide-code", Password: "lucide-key-round",
	Phone: "lucide-phone", Int: "lucide-hash", Float: "lucide-hash", Currency: "lucide-banknote", Percent: "lucide-percent",
	Rating: "lucide-star", Duration: "lucide-timer", Check: "lucide-square-check", Select: "lucide-list",
	Autocomplete: "lucide-list", Color: "lucide-palette", Date: "lucide-calendar", Datetime: "lucide-calendar-clock",
	Time: "lucide-clock", Link: "lucide-link", "Dynamic Link": "lucide-link-2", Table: "lucide-table",
	"Table MultiSelect": "lucide-tags", Attach: "lucide-paperclip", "Attach Image": "lucide-image",
	Signature: "lucide-pen-line", Geolocation: "lucide-map-pin", JSON: "lucide-braces", Button: "lucide-mouse-pointer-click",
	"Read Only": "lucide-lock", HTML: "lucide-code-xml", Barcode: "lucide-barcode", Icon: "lucide-smile",
};

export const iconOf = (fieldtype: string) => ICONS[fieldtype] ?? "lucide-type";
