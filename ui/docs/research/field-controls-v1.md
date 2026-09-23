# What desk v1 does for each missing and thin field control

Research for the map "Desk v2: every fieldtype has a control" (frappe/frappe#43206),
ticket frappe/frappe#43207. It records what desk v1 does today. It makes no decision.

Source: `develop` at `6a5c8b0e73`. Every fact below was read from that code. Library
sizes come from `node_modules` in a local checkout with the same `package.json` pins.

Short names used in citations:

| Short name | Path |
|---|---|
| `C/` | `frappe/public/js/frappe/form/controls/` |
| `F` | `frappe/public/js/frappe/form/formatters.js` (client read-only view) |
| `U` | `frappe/public/js/frappe/utils/utils.js` |
| `BD` | `frappe/model/base_document.py` |
| `DOC` | `frappe/model/document.py` |
| `FU` | `frappe/utils/__init__.py` |
| `SF` | `frappe/utils/formatters.py` (server `format_value`, used by print and email) |
| `MDB` | `frappe/database/mariadb/database.py` (column types) |

## How every control saves a value

These rules apply to every row in the table, so they are stated once here.

- **On change, in the browser.** Each control runs `parse()` and then `validate()`, then calls
  `frappe.model.set_value` (`frappe/public/js/frappe/form/controls/base_control.js:200-288`).
  For Data options, `validate()` only sets `df.invalid`, which draws a red border
  (`frappe/public/js/frappe/form/controls/base_input.js:277-288`). **The bad value is still
  written to the doc.** Nothing blocks the save in the browser.
- **On save, on the server.** `_validate` runs its checks in this order: mandatory, data
  fields, selects, non-negative, min/max, rating clamp, code, autoname, text-editor image
  extraction, HTML sanitize, passwords, workflow, length (`DOC:1085-1111`). The non-negative
  and min/max checks cover only Int, Float, Currency and Percent (`DOC:1135-1136`,
  `DOC:1156`). **None of the controls in this table gets those two checks.**
- **HTML is cleaned on the server.** Any string containing `<` or `>` goes through nh3
  (`BD:1400-1438`). The exceptions are fields with `ignore_xss_filter`, Data/Text with the
  Email option, and the Attach, Attach Image, Barcode, Code and JSON fieldtypes
  (`BD:1422-1430`).
- **Length is checked on the server.** A varchar column is limited to `df.length`, or 140
  when that is unset (`BD:1294-1327`; `frappe/database/database.py:96`). Any `length` below 64
  is raised to 64 (`frappe/database/schema.py:459-462`). The browser sets `maxlength` only on
  Data, Link, Dynamic Link, Password, Select and Read Only (`C/data.js:234-245`).
- **The read-only view.** `set_disp_area` calls `frappe.format`
  (`C/base_input.js:148-178`). That looks up `frappe.form.formatters[fieldtype without
  spaces]` and **falls back to the Data formatter** when there is none (`F:430-433`).
- **Properties that work on every Data-based control:** `placeholder`, `length`,
  `input_class`, `input_css`, `alignment`, `with_copy_button`, `description`, `bold`, `reqd`,
  `read_only`, `hidden`, `on_make`, `get_status` (`C/data.js:131-266`;
  `C/base_input.js:12,81-83`; `C/base_control.js:49`).

## The table

| Control | Widget it draws | Stored value (DB column) | What validates, and where | Library (size) | Read-only view | What scripts commonly set |
|---|---|---|---|---|---|---|
| **Text Editor** | Quill editor in a div (`C/text_editor.js:195-207`). The toolbar has headers, sizes, bold/italic/underline/strike, colours, blockquote, code, RTL, link, image, three list types, align, indent and a table menu (`:498-526`). Images can be resized (`:399-411`). @-mentions are optional (`:458-485`). | An HTML string always wrapped in `<div class="ql-editor read-mode">…</div>`. Example: `<div class="ql-editor read-mode"><p>Hello</p></div>` (`:554-569`). An empty editor still saves `<p><br></p>` inside the wrapper. longtext (`MDB:193`). | **Browser, on change:** `parse` strips script, style, link and meta tags (`:528-533`; `frappe/public/js/frappe/dom.js:33`). **Server:** the mandatory check counts text or an `<img>` as filled (`BD:1022-1028`). Pasted base64 images become File records (`BD:1632-1637`). HTML is cleaned by nh3 (`BD:1436`). No length limit. | quill 2.0.3 (`package.json:71`; `dist/quill.js` 209 KB). quill-magic-url 3.0.2 (57 KB). frappe-quill-image-resize 3.0.9. **All three are in the eager `controls.bundle.js`** (`C/control.js:17`; `frappe/public/js/controls.bundle.js:4`). | `formatters.TextEditor` turns newlines into `<br>` when there are no block tags, then wraps the result in `.ql-editor.read-mode` (`F:330-345`, `F:257-275`). The server print wraps it in `<div class='ql-snow'>` (`SF:127-128`). | `df.max_height` (`:198-200`). `df.get_toolbar_options()` (`:432-434`). `df.theme` (`:443`). `df.placeholder` (`:446`). `df.enable_mentions` and `mention_search_method` (`:458-485`). |
| **Color** | An input with a swatch next to it (`C/color.js:60-63`). A popover opens frappe's own picker: 12 swatches (11 distinct, since `#29CD42` appears twice), a saturation map and a hue slider (`C/color.js:15-28`; `frappe/public/js/frappe/color_picker/color_picker.js:21-31`). | A hex string, e.g. `#449CF0` (`C/color.js:56-58`). varchar(140) (`MDB:210`). | **Browser, on change:** it must match `/^#[0-9A-F]{6}$/i`. **Anything else becomes `null`**, with no error shown (`C/color.js:107-116`). So `#fff` and `rgb()` are rejected. **Server:** no colour check. Only the length check and HTML cleaning run. | Frappe's own `Picker` class (`color_picker.js`, 6.2 KB, plus `color_picker/utils.js`, 2.1 KB). No npm library. | `formatters.Color`: a swatch div plus the hex text (`F:393-400`). The server returns the raw value (`SF:148`). | `df.placeholder` (defaults to "Choose a color", `C/color.js:5`). |
| **Icon** | An input with a preview icon. A popover holds a search box and an icon grid, with "Custom" and "Lucide" sections (`C/icon.js:18-34,74-79`; `frappe/public/js/frappe/icon_picker/icon_picker.js:19-24`). | An icon name such as `list-check`, or an emoji character (`C/icon.js:110-119`). varchar(140) (`MDB:214`). | **None, in the browser or on the server.** Any string is accepted. `get_icon()` shows `folder` when the value is empty (`C/icon.js:117-119`). | No library. The icon list is read from the page's SVG sprite, `#all-symbols > svg > symbol[id]` (`C/icon.js:11-16`). That sprite is `frappe/public/icons/lucide/icons.svg` (526 KB, 1853 symbols), loaded through `app_include_icons` (`frappe/hooks.py:39-42`). Custom icons come from `frappe.boot.custom_icons`. | `formatters.Icon`: the icon's SVG plus its name, or just the emoji (`F:401-413`). The server returns the raw value (`SF:148`). | `df.options = "Emojis"` adds an emoji tab (`C/icon.js:42`; `icon_picker.js:32-73`). `df.placeholder` defaults to "Choose an icon" (`C/icon.js:5`). |
| **Signature** | A drawing pad 200 px tall, as wide as its container, rebuilt when the container resizes. Line width 2, colours from CSS variables (`C/signature.js:14-39`). A clear button (`:42-53,124-127`). In read mode the pad is swapped for an `<img>`, or a "ban" icon when empty (`:19-25,69-77`). | A PNG data URL at the canvas size, `data:image/png;base64,iVBOR…` (`:131`; jSignature's default export). longtext (`MDB:209`). | **None.** HTML cleaning never triggers because a data URL has no `<` or `>` (`BD:1411-1413`). No size limit. | **jSignature v2, "frappe edition"**, stored in the repo at `frappe/public/js/lib/jSignature.min.js` (47.6 KB). It is not an npm package and is not signature_pad. It loads on first use with `frappe.require` (`:12`). | The control itself shows an `<img>` (`:69-77`). **There is no Signature formatter**, so list, grid and report cells fall back to Data and **show the raw base64 text** (`F:430-433`). Print shows an `<img>` (`frappe/templates/print_formats/standard_macros.html:156-158`). | Nothing specific to Signature. |
| **Barcode** | A text input with a JsBarcode `<svg>` drawn below it (`C/barcode.js:8-11`). **No scanner button.** The scanner exists only on Data with the Barcode option. | **SVG markup, not the typed value.** `<svg data-barcode-value="12345" width="100%" …>…</svg>` (`:14-23,45-52`). Rendering a doc rewrites a raw stored value into SVG in `this.doc` (`:35-38`). longtext (`MDB:211`). | **Browser, on change:** only a JsBarcode exception, shown as the description "Invalid Barcode: …" (`:53-55`). **Server:** none, and it is left out of HTML cleaning on purpose so the SVG survives (`BD:1428`). | jsbarcode 3.11.6 (`package.json:59`; `JsBarcode.all.min.js` 61 KB). It is imported eagerly (`C/barcode.js:1`), so it ships in `controls.bundle.js`. It is also in `print.bundle.js`. | There is no Barcode formatter. The Data fallback outputs the stored SVG as HTML, so a barcode is drawn anyway. Print draws an svg when the value is not already one (`standard_macros.html:159-160`). Grid search reads `data-barcode-value` out of the SVG (`frappe/public/js/frappe/form/grid.js:1038-1045`). | `df.options` holds JsBarcode JSON options: `format` (`"EAN"` picks EAN8 or EAN13 by length), `fontSize`, `width`, `height`, and `valueField`, which copies the raw value into another field (`C/barcode.js:59-77`). |
| **Phone** | An input with a country button showing a flag and the dial code. The flag images load from **flagcdn.com** (`C/phone.js:126-138,204-208`). A popover lists countries, searchable by name or dial code (`frappe/public/js/frappe/phone_picker/phone_picker.js:35-80`). The default country is `sys_defaults.country`, or India if unset (`C/phone.js:25-31`). | **`<dial code>-<number>`**, e.g. `+91-9999999999` (`:67,195`). The input shows only the part after the dash (`:193`). varchar(140) (`MDB:215`). | **Browser:** nothing of its own. It inherits Data's `validate`, which acts only when options is Phone. **Server, on save:** the Python `phonenumbers` library's `is_valid_number(parse(value))` with no default region, so a `+<country code>` is required. Errors are "Please select a country code for field {1}" or "Phone Number {0} set in field {1} is not valid" (`FU:117-141`, called from `BD:1235-1237`). | `localforage` caches the country list (`C/phone.js:13-23`). The list itself comes from `frappe.geo.country_info.get_country_timezone_info`, a server call on the first load (`:19-20`). | **No Phone formatter.** It falls back to Data: plain text, no `tel:` link, no flag. | Nothing specific to Phone. Scripts set the value in the `+91-…` form. |
| **Data, Email** | A plain text input (`C/data.js:12-17`). | A string, and **several addresses are allowed**, split on commas or newlines, e.g. `a@x.com, b@y.com`. varchar(140). | **Browser, on change:** each address from `split_emails` is checked with the emailregex.com pattern. A bad one sets `df.invalid` (a red border) but the value is still saved (`C/data.js:306-319`; `frappe/public/js/frappe/utils/datatype.js:41`). **Server, on save:** throws `InvalidEmailAddressError` using its own, different regex (`BD:1251-1256`; `FU:53-56,183-230`). Standard-user owners are skipped (`BD:1252-1253`). Not HTML-cleaned (`BD:1427`). | None. | Data formatter: plain text, **no `mailto:` link** (`F:36-48`). | `df.options = "Email"`. |
| **Data, URL** | A text input plus an "Open Link" button that appears when the value is a valid URL (`C/data.js:81-122`). | A string, e.g. `https://frappe.io`. varchar(140). | **Browser, on change:** the `url` regex in `validate_type` (`C/data.js:320-322`; `U:513`). **Server, on save:** `validate_url` has no regex. It accepts anything with a scheme plus a host or path, or anything starting with `/`. It does not restrict the scheme, so **`javascript:x` passes** (`FU:246-270`, called from `BD:1264-1265`). | None. | `<a href="${value}" target="_blank">`, with the value **not escaped** (`F:37-40`). | `df.options = "URL"`. |
| **Data, Phone** | A plain text input. | A string, e.g. `+91 99999 99999`. varchar(140). | **Browser, on change:** `/^([0-9 +_\-,.*#()]){1,20}$/` sets `df.invalid` (`C/data.js:300-302`; `datatype.js:45`). **Server, on save:** the same character set, `r"([0-9\ \+\_\-\,\.\*\#\(\)]){1,20}$"` with `re.match`. It throws `InvalidPhoneNumberError` (`FU:49,144-160`; `BD:1261-1262`). **No `phonenumbers` check**, unlike the Phone fieldtype. | None. | Plain text, no `tel:` link (`F:36-48`). | `df.options = "Phone"`. |
| **Data, Name** | A plain text input. | A string, e.g. `Mary-Jane O'Neil`. varchar(140). | **Browser, on change:** `/^[\w][\w'-]*([ \w][\w'-]+)*$/` (`C/data.js:303-305`). **Server, on save:** `r"^[\w][\w\'\-]*( \w[\w\'\-]*)*$"` throws `InvalidNameError` (`FU:50,163-180`; `BD:1258-1259`). **The two patterns differ slightly.** | None. | Plain text. | `df.options = "Name"`. |
| **Data, IBAN** | A text input that shows the value in groups of four, and reformats on blur. Grouping is skipped for BI, SV, EG and LY (`C/data.js:124-128,282-284`; `U:1289-1295`). | Spaces are stripped: `DE89370400440532013000` (`C/data.js:288-290`). varchar(140). | **Browser: none.** **Server, on save:** a mod-97 checksum only, with no country or length table. Error: "'{0}' is not a valid IBAN" (`FU:273-305`; `BD:1267-1268`). | None. | Grouped in fours (`F:41-44`). | `df.options = "IBAN"`. |
| **Data, Barcode** | A text input plus a scan button that opens `frappe.ui.Scanner`, which uses the camera (`C/data.js:146-173`; `frappe/public/js/frappe/scanner/index.js:3,55`). | The **raw** scanned text, e.g. `8901234567890`. This differs from the Barcode fieldtype, which stores SVG. varchar(140). | **None, in the browser or on the server.** The value is HTML-cleaned (the Barcode exemption applies only to the fieldtype) and length-checked. | html5-qrcode 2.3.8 (`package.json:56`; `html5-qrcode.min.js` 375 KB). It loads only when the scanner opens (`scanner/index.js:301`). | Plain text. | `df.options = "Barcode"`. |
| **Data, plain** | A text input. Pasting past `maxlength` shows a "Data Clipped" message (`C/data.js:12-62`). Fields named `field:<name>` or `__newname` check whether the name already exists (`:195-233`). | A string. varchar(`length` or 140). | **Browser:** `maxlength` only. **Server:** length limit and HTML cleaning. Allows `unique` (`frappe/core/doctype/doctype/doctype.py:1538`). An unknown option only shows an alert when the DocType is saved; it does not throw (`doctype.py:1739-1753`). | None. | Data formatter, through the `formatter` hook if one is set (`F:18-48`). | `length`, `placeholder`, `with_copy_button`, `formatter`, `options`. |
| **Read Only** | **The Data control itself**, always in Read status: `ControlReadOnly = ControlData` (`C/data.js:336`; `C/base_control.js:68`). There is no `read_only.js`. | A string. A non-string value is converted with `cstr` on save (`BD:605-606`). varchar(140) (`MDB:206`). | **Server:** length limit and HTML cleaning. Allows `unique`. | None. | Data formatter. | Usually `fetch_from`, or a value set by the controller. |
| **Long Int** | **The Int control itself**: `ControlLongInt = ControlInt` (`C/int.js:28`). An input with `inputmode="numeric"` that evaluates expressions such as `2*3` (`C/int.js:4,18-25`). There is no `long_int.js`. | A number. `parse` is `cint(...)`, **a JavaScript Number, so precision is lost above 2^53** (`C/int.js:23-25`). bigint(20) (`MDB:186`). | **Browser, on change:** `validate = parse`. **Server:** not cast (the Int-only cast at `BD:590-609` skips it). It is bounded to ±(2^63-1) by the length check (`BD:1319-1327`). **No non-negative or min/max check.** | None. | **No `LongInt` formatter**, so it falls back to Data: left-aligned text, **not** the right-aligned Int format (`F:80-89` does not apply). | **It cannot be picked as a fieldtype.** It is missing from the DocField and Custom Field option lists (`frappe/core/doctype/docfield/docfield.json:119`). You get it by giving an Int field a `length` over 11 (`frappe/database/schema.py:443-444`). |
| **Duration** | An input that opens a floating picker with number boxes for days, hours, minutes and seconds (`C/duration.js:14-66,126-153`). You can also type `1d 2h 3m 4s`, or a plain number for seconds (`:159-178,235-256`). | **Whole seconds**, e.g. `93784` for 1d 2h 3m 4s (`:91-103,155-157`). decimal(21,9) (`MDB:213`). | **Browser:** an empty value becomes null. Text that does not match the pattern becomes null (`:7-12,159-178`). **Server:** no cast, clamp or check. | None. | `formatters.Duration` shows "1d 2h 3m 4s", or "0s" when empty (`F:283-290`; `U:1259-1287`). The server's `format_duration` drops fractional seconds (`frappe/utils/data.py:812-842`; `SF:123-125`). | `df.hide_days`, `df.hide_seconds` (`U:1336-1341`). |
| **Rating** | N inline SVG stars in place of the input. Half stars are allowed, based on which half of a star is clicked (`C/rating.js:4-19,56-59`). Clicking the current value clears it unless the field is required (`:61-70`). It is a subclass of Float (`:1`). | **A fraction from 0 to 1**: 3.5 of 5 stars is stored as `0.7` (`:86`). decimal(3,2) (`MDB:205`). Values have been fractions since the v14 patch (`frappe/patches/v14_0/save_ratings_in_fraction.py:34`). | **Browser:** `parseFloat` (`:114-116`). **Server:** `_fix_rating_value` clamps to 0..1, and empty becomes 0.0 (`DOC:1180-1186`). The DocType rule is that `options` must be 3 to 10 (`doctype.py:1792-1795`). | None. | `formatters.Rating`: the same SVG stars, rounded to the nearest half (`F:107-125`). The list tooltip shows value times stars (`frappe/public/js/frappe/list/list_view.js:1482-1485`). The server returns the raw fraction (`SF:148`). | `df.options` = number of stars, default 5 (`C/rating.js:5`). |

## Facts a grilling will need

1. **The browser never blocks a bad Data value.** Email, URL, Phone and Name only draw a red
   border (`df.invalid`) and still write the value. The server throws on save. Browser and
   server use **different regexes** for Email, URL and Name. For example, the server accepts
   any `scheme:` URL, including `javascript:`, while the Data formatter puts the raw value
   into an unescaped `href` (`F:37-40`).
2. **"Phone" means two different things.** The Phone fieldtype stores `+91-9999999999` and is
   checked by the Python `phonenumbers` library. Data with the Phone option is a 1 to 20
   character check. A control built for one will be wrong for the other.
3. **Barcode (the fieldtype) stores SVG markup, not the code.** The raw value lives only in
   `data-barcode-value`. Barcode is also exempt from HTML cleaning. Data with the Barcode
   option stores the raw text and is the only one with a camera scanner. A v2 control that
   stores the raw value would break print, grid search and existing data.
4. **Six of these controls have no formatter**: Signature, Barcode, Phone, Long Int, Read
   Only, and Data with Email or Phone. They show plain text. For Signature that means a
   base64 blob in list and report cells. Long Int shows left-aligned, unlike Int.
5. **Long Int and Read Only are aliases, not controls.** They are `ControlInt` and
   `ControlData` (`C/int.js:28`, `C/data.js:336`). Long Int cannot be picked in DocType
   settings; it appears when an Int has `length > 11`. Its JavaScript Number loses precision
   above 2^53.
6. **Signature uses jSignature, not signature_pad.** It is a 47.6 KB file kept in the repo
   and loaded on first use. The value is a full-canvas PNG data URL with no size limit.
7. **Rating is a 0 to 1 fraction**, not a star count. The server clamps it to 0..1.
   `df.options` sets the star count (3 to 10, default 5).
8. **Color turns anything that is not `#RRGGBB` into `null` without an error.** Short hex,
   alpha and `rgb()` are all dropped. The server does not check colours at all.
9. **Icon values are not checked anywhere**, and the icon list is read from the page's SVG
   sprite (1853 Lucide symbols). Emoji are offered only when `options = "Emojis"`.
10. **Text Editor always wraps its HTML** in `<div class="ql-editor read-mode">`, and an
    empty editor still saves `<p><br></p>` inside it. Quill, magic-url and image-resize are
    all in the eager controls bundle, not loaded on demand. Pasted images are embedded as
    base64 and turned into File records on save.
11. **Duration is whole seconds** in a decimal(21,9) column. Weeks exist in the multiplier
    table but cannot be typed (`C/duration.js:227-233`).
12. **Phone makes network calls**: flag images from flagcdn.com, and a server call for the
    country list, cached in localforage.
