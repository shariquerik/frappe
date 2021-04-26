import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import RawTool from '@editorjs/raw';
import Checklist from '@editorjs/checklist';
import List from '@editorjs/list';
import DragDrop from 'editorjs-drag-drop';
import Undo from 'editorjs-undo';

import ChartWidget from "../widgets/chart_widget";
import BaseWidget from "../widgets/base_widget";
import ShortcutWidget from "../widgets/shortcut_widget";
import LinksWidget from "../widgets/links_widget";
import OnboardingWidget from "../widgets/onboarding_widget";
import NumberCardWidget from "../widgets/number_card_widget";

frappe.provide("frappe.widget");

frappe.widget.widget_factory = {
	chart: ChartWidget,
	base: BaseWidget,
	shortcut: ShortcutWidget,
	links: LinksWidget,
	onboarding: OnboardingWidget,
	number_card: NumberCardWidget,
};

frappe.widget.make_widget = (opts) => {
	const widget_class = frappe.widget.widget_factory[opts.widget_type];
	if (widget_class) {
		return new widget_class(opts);
	} else {
		// eslint-disable-next-line
		console.warn("Invalid Widget Name: " + opts.widget_type);
	}
};

frappe.views.Wiki = class Wiki {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.pages = {};
		this.sections = {};
		this.sidebar_items = {};
		this.tools = {}
		this.prepare_container();
		this.setup_wiki_pages();
	}

	prepare_container() {
		let list_sidebar = $(`
			<div class="list-sidebar overlay-sidebar hidden-xs hidden-sm">
				<div class="desk-sidebar list-unstyled sidebar-menu"></div>
			</div>
		`).appendTo(this.wrapper.find(".layout-side-section"));
		this.sidebar = list_sidebar.find(".desk-sidebar");
		this.body = this.wrapper.find(".layout-main-section");
		// this.body.addClass("frappe-card");
	}

	setup_wiki_pages() {
		this.get_pages().then(() => {
			if(this.all_pages) {
				frappe.wiki_pages = {};
				
				for (let page of this.all_pages || []) {
					frappe.wiki_pages[frappe.router.slug(page.name)] = page;
				}
				frappe.router.route();
				this.make_sidebar(this.all_pages.filter(page => page.parent_page == null), '');
			}
		})
	}

	get_pages() {
		return frappe.xcall("frappe.desk.doctype.internal_wiki_page.internal_wiki_page.get_pages").then(data => {
			this.all_pages = data;
		});
	}

	make_sidebar(items, new_page) {
		if (this.sidebar.find('.standard-sidebar-section')[0]) {
			this.sidebar.find('.standard-sidebar-section')[0].remove()
		}
		let sidebar_section = $(`<div class="standard-sidebar-section"></div>`);

		const get_sidebar_item = function (item) {
			return $(`
				<div class="standard-sidebar-item-container">
					<div class="desk-sidebar-item standard-sidebar-item ${item.selected ? "selected" : ""}">
						<a
							href="/app/wiki/${frappe.router.slug(item.name)}"
						>
							<span>${frappe.utils.icon(item.icon || "folder-normal", "md")}</span>
							<span class="sidebar-item-label">${item.label || item.name}<span>
						</a>
						<span>${frappe.utils.icon("small-down", "sm")}</span>
					</div>
					<div class="sidebar-child-item"></div>
				</div>
			`);
		};

		const make_sidebar_category_item = item => {
			if (item.name == this.get_page_to_show() && new_page === '') {
				item.selected = true;
				this.current_page_name = item.name;
			}

			const get_child_item = function (item) {
				return $(`
					<div class="sidebar-child-item-container">
						<a
							href="/app/wiki/${frappe.router.slug(item.name)}"
							class="desk-sidebar-item standard-sidebar-item ${item.selected ? "selected" : ""}"
						>
							<span>${frappe.utils.icon(item.icon || "folder-normal", "md")}</span>
							<span class="sidebar-item-label">${item.label || item.name}<span>
						</a>
					</div>
				`);
			}
	
			const make_sidebar_child_item = item => {
				let $child_item = get_child_item(item);
				$child_item.appendTo(child_item_section)
			}

			let $item = get_sidebar_item(item);
			let child_item_section = $item.find('.sidebar-child-item').get(0);

			let child_items = this.all_pages.filter(page => page.parent_page == item.name)
			child_items.forEach(item => make_sidebar_child_item(item));

			$item.appendTo(sidebar_section);
			this.sidebar_items[item.name] = $item;
		};

		items.forEach(item => make_sidebar_category_item(item));

		sidebar_section.appendTo(this.sidebar);
	}

	show() {
		if (!this.all_pages) {
			// pages not yet loaded, call again after a bit
			setTimeout(() => {
				this.show();
			}, 500);
			return;
		}
		let page = this.get_page_to_show();
		this.page.set_title(`${__(page)}`);
		this.show_page(page);
		this.get_content(page).then(() => {
			this.get_data(page).then(() => {
				if(this.content){
					this.tools = {
						header: {
							class: Header,
							inlineToolbar: true
						},
						paragraph: {
							class: Paragraph,
							inlineToolbar: true
						},
						raw: RawTool,
						checklist: {
							class: Checklist,
							inlineToolbar: true,
						},
						list: {
							class: List,
							inlineToolbar: true,
						},
						chart: {
							class: Chart,
							config: {
								page_data: this.page_data || []
							}
						},
						card: {
							class: Card,
							config: {
								page_data: this.page_data || []
							}
						},
						shortcut: {
							class: Shortcut,
							config: {
								page_data: this.page_data || []
							}
						},
						spacingTune: MyBlockTune,
					}
					if(this.editor) {
						this.editor.isReady.then(() => {
							this.editor.configuration.tools.chart.config.page_data = this.page_data;
							this.editor.configuration.tools.shortcut.config.page_data = this.page_data;
							this.editor.configuration.tools.card.config.page_data = this.page_data;
							this.editor.render({
								blocks: JSON.parse(this.content) || []
							})
						})
					} else {
						this.initialize_editorjs(JSON.parse(this.content));
					}
				}
			})
		})
	}

	get_content(page) {
		return frappe.xcall("frappe.desk.doctype.internal_wiki_page.internal_wiki_page.get_page_content",
			{
				page: page
			}
		).then(data => {
			this.content = data;
		});
	}

	get_data(page) {
		return frappe.xcall("frappe.desk.desktop.get_desktop_page", {
			page: page
		}).then(data => {
			this.page_data = data;
		});
	}

	get_page_to_show() {
		let default_page;

		if (localStorage.current_wiki_page) {
			default_page = localStorage.current_wiki_page;
		} else if (this.all_pages) {
			default_page = this.all_pages[0].name;
		} else {
			default_page = "Home";
		}

		let page = frappe.get_route()[1] || default_page;
		return page;
	}

	show_page(page) {
		if (this.current_page_name && this.pages[this.current_page_name]) {
			this.pages[this.current_page_name].hide();
		}

		if (this.sidebar_items && this.sidebar_items[this.current_page_name]) {
			this.sidebar_items[this.current_page_name][0].firstElementChild.classList.remove("selected");
			this.sidebar_items[page][0].firstElementChild.classList.add("selected");
		}
		this.current_page_name = page;
		localStorage.current_wiki_page = page;

		this.current_page = this.pages[page];

		if (!this.body.find('#editorjs')[0]) {
			this.$page = $(`
				<div id="editorjs" class="wiki-page page-main-content"></div>
			`).appendTo(this.body);
		}

		this.page.set_primary_action(
			__("Save"),
			() => {
				this.save_page();
			},
			null,
			__("Saving")
		);

		this.page.set_secondary_action(
			__("New Page"),
			() => {
				let me = this;
				if(this.dirty) {
					frappe.warn('Are you sure you want to proceed?',
						'There are unsaved changes on this page',
						() => {
							me.initialize_new_page();
							me.dirty = false;
						},
						'Continue'
					)
				} else {
					this.initialize_new_page();
					this.dirty = false;
				}
			}
		)
	}

	initialize_new_page() {
		const d = new frappe.ui.Dialog({
			title: __('Set Title'),
			fields: [
				{ label: __('Title'), fieldtype: 'Data', fieldname: 'title'},
				{ label: __('Parent'), fieldtype: 'Select', fieldname: 'parent', options: this.all_pages.map(pages => pages.name)}
			],
			primary_action_label: __('Create'),
			primary_action: (values) => {
				d.hide();
				this.title = values.title;
				this.parent = values.parent;
				// const index = this.all_pages.findIndex(e => e.selected == true )
				// this.all_pages[index].selected = false;
				// let item = {name: this.title, selected: true}
				// this.make_sidebar([...this.all_pages, item], 'new')
				this.editor.render({
					blocks: [
						{
							type: "header",
							data: {
								text: this.title,
								level: 2
							}
						}
					]
				}).then(() => {
					this.dirty = false;
				})
			}
		});
		d.show();
	}

	initialize_editorjs(blocks) {
		this.dirty = false;
		const data = {
			blocks: blocks || []
		}
		this.editor = new EditorJS({
			tools: this.tools,
			autofocus: false,
			data,
			tunes: ['spacingTune'],
			onChange: () => {
				this.dirty = true;
			},
			onReady: () => {
				const undo = new Undo({ editor: this.editor });
				undo.initialize(data);
				new DragDrop(this.editor);

				new Sortable(this.page.sidebar.find(".standard-sidebar-section").get(0), {
					handle: '.standard-sidebar-item-container',
					draggable: '.standard-sidebar-item-container',
					animation: 100,
					onUpdate: (event) => {
						let item = $(event.item).closest('.standard-sidebar-item-container');
					}
				});
			},
			readOnly: false,
		});
	}

	save_page() {
		frappe.dom.freeze();
		let save = true;
		if (!this.title && this.current_page_name) {
			this.title = this.current_page_name;
			save = '';
		}
		let me = this;
		this.editor.save().then((outputData) => {
			frappe.call({
				method: "frappe.desk.doctype.internal_wiki_page.internal_wiki_page.save_wiki_page",
				args: {
					title: me.title,
					parent: me.parent || '',
					blocks: JSON.stringify(outputData.blocks),
					save: save
				},
				callback: function(res) {
					frappe.dom.unfreeze();
					if (res.message) {
						frappe.show_alert({ message: __("Page Saved Successfully"), indicator: "green" });
						me.title = '';
						me.parent = '';
						me.reload();
					}
				}
			});
		}).catch((error) => {
			console.log('Saving failed: ', error);
		});
	}

	reload() {
		this.setup_wiki_pages();
	}
}

class Chart {
	static get toolbox() {
		return {
			title: 'Chart',
			icon: '<svg height="18" width="18" viewBox="0 0 512 512"><path d="M117.547 234.667H10.88c-5.888 0-10.667 4.779-10.667 10.667v256C.213 507.221 4.992 512 10.88 512h106.667c5.888 0 10.667-4.779 10.667-10.667v-256a10.657 10.657 0 00-10.667-10.666zM309.12 0H202.453c-5.888 0-10.667 4.779-10.667 10.667v490.667c0 5.888 4.779 10.667 10.667 10.667H309.12c5.888 0 10.667-4.779 10.667-10.667V10.667C319.787 4.779 315.008 0 309.12 0zM501.12 106.667H394.453c-5.888 0-10.667 4.779-10.667 10.667v384c0 5.888 4.779 10.667 10.667 10.667H501.12c5.888 0 10.667-4.779 10.667-10.667v-384c0-5.889-4.779-10.667-10.667-10.667z"/></svg>'
		};
	}

	static get isReadOnlySupported() {
		return true;
	}

	constructor({data, api, config, readOnly}){
		this.data = data;
		this.api = api;
		this.config = config;
		this.readOnly = readOnly;
		this.sections = {};
		this.col = this.data.col ? this.data.col : "12",
		this.pt = this.data.pt ? this.data.pt : "0",
		this.pr = this.data.pr ? this.data.pr : "0",
		this.pb = this.data.pb ? this.data.pb : "0",
		this.pl = this.data.pl ? this.data.pl : "0"
	}

	render() {
		let me = this;
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('p-2');
		this._make_fieldgroup(this.wrapper, [{
			fieldtype: "Select", 
			label: "Chart Name", 
			fieldname: "chart_name",
			options: this.config.page_data.charts.items.map(({ chart_name }) => chart_name),
			change: function() {
				if (this.value) {
					me._make_charts(this.value)
				}
			}
		}]);
		if (this.data && this.data.chart_name) {
			this._make_charts(this.data.chart_name)
		}
		return this.wrapper;
	}

	save(blockContent) {
		return {
			chart_name: blockContent.getAttribute('chart_name'),
			col: this._getCol(),
			pt: this._getPadding("t"),
			pr: this._getPadding("r"),
			pb: this._getPadding("b"),
			pl: this._getPadding("l")
		}
	}

	rendered() {
		var e = this.wrapper.parentNode.parentNode;
		e.classList.add("col-" + this.col)
		e.classList.add("pt-" + this.pt)
		e.classList.add("pr-" + this.pr)
		e.classList.add("pb-" + this.pb)
		e.classList.add("pl-" + this.pl)
	}

	_getCol() {
		var e = 12,
		t = "col-12",
		n = this.wrapper.parentNode.parentNode,
		r = new RegExp(/\bcol-.+?\b/, "g");
		if (n.className.match(r)) {
			n.classList.forEach(function (e) {
				e.match(r) && (t = e);
			});
			var a = t.split("-");
			e = parseInt(a[1]);
		}
		return e;
	}

	_getPadding() {
		var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "l",
		t = 0,
		n = "p" + e + "-0",
		r = this.wrapper.parentNode.parentNode,
		a = new RegExp(/\pl-.+?\b/, "g"),
		i = new RegExp(/\pr-.+?\b/, "g"),
		o = new RegExp(/\pt-.+?\b/, "g"),
		c = new RegExp(/\pb-.+?\b/, "g");
		if ("l" == e) {
			if (r.className.match(a)) {
				r.classList.forEach(function (e) {
					e.match(a) && (n = e);
				});
				var s = n.split("-");
				t = parseInt(s[1]);
			}
		} else if ("r" == e) {
			if (r.className.match(i)) {
				r.classList.forEach(function (e) {
					e.match(i) && (n = e);
				});
				var l = n.split("-");
				t = parseInt(l[1]);
			}
		} else if ("t" == e) {
			if (r.className.match(o)) {
				r.classList.forEach(function (e) {
					e.match(o) && (n = e);
				});
				var u = n.split("-");
				t = parseInt(u[1]);
			}
		} else if ("b" == e && r.className.match(c)) {
			r.classList.forEach(function (e) {
				e.match(c) && (n = e);
			});
			var p = n.split("-");
			t = parseInt(p[1]);
		}
		return t;
	}

	_make_fieldgroup(parent, ddf_list) {
		this.chart_field = new frappe.ui.FieldGroup({
			"fields": ddf_list,
			"parent": parent
		});
		this.chart_field.make();
	}

	_make_charts(chart_name) {
		let chart = this.config.page_data.charts.items.find(obj => {
			return obj.chart_name == chart_name
		});
		this.wrapper.innerHTML = '';
		this.sections = {};
		this.sections["charts"] = new WidgetGroup({
			container: this.wrapper,
			type: "chart",
			columns: 1,
			class_name: "widget-charts",
			// hidden: Boolean(this.onboarding_widget),
			options: {
				// allow_sorting: this.allow_customization,
				// allow_create: this.allow_customization,
				// allow_delete: this.allow_customization,
				allow_hiding: false,
				allow_edit: true,
				max_widget_count: 2,
			},
			widgets: chart
		});
		this.wrapper.setAttribute("chart_name", chart_name)
	}
}

class Card {
	static get toolbox() {
		return {
			title: 'Card',
			icon: '<svg height="24" width="24" viewBox="0 0 24 24"><path d="M7 15h3a1 1 0 000-2H7a1 1 0 000 2zM19 5H5a3 3 0 00-3 3v9a3 3 0 003 3h14a3 3 0 003-3V8a3 3 0 00-3-3zm1 12a1 1 0 01-1 1H5a1 1 0 01-1-1v-6h16zm0-8H4V8a1 1 0 011-1h14a1 1 0 011 1z"/></svg>'
		};
	}

	static get isReadOnlySupported() {
		return true;
	}

	constructor({data, api, config, readOnly, block}){
		this.data = data;
		this.api = api;
		this.config = config;
		this.readOnly = readOnly;
		this.sections = {};
		this.col = this.data.col ? this.data.col : "12",
		this.pt = this.data.pt ? this.data.pt : "0",
		this.pr = this.data.pr ? this.data.pr : "0",
		this.pb = this.data.pb ? this.data.pb : "0",
		this.pl = this.data.pl ? this.data.pl : "0"
	}

	render() {
		let me = this;
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('p-2');
		this._make_fieldgroup(this.wrapper, [{
			fieldtype: "Select", 
			label: "Card Name", 
			fieldname: "card_name",
			options: this.config.page_data.cards.items.map(({ label }) => label),
			change: function() {
				if (this.value) {
					me._make_cards(this.value)
				}
			}
		}]);
		if (this.data && this.data.card_name) {
			this._make_cards(this.data.card_name)
		}
		return this.wrapper;
	}

	save(blockContent) {
		return {
			card_name: blockContent.getAttribute('card_name'),
			col: this._getCol(),
			pt: this._getPadding("t"),
			pr: this._getPadding("r"),
			pb: this._getPadding("b"),
			pl: this._getPadding("l")
		}
	}

	rendered() {
		var e = this.wrapper.parentNode.parentNode;
		e.classList.add("col-" + this.col)
		e.classList.add("pt-" + this.pt)
		e.classList.add("pr-" + this.pr)
		e.classList.add("pb-" + this.pb)
		e.classList.add("pl-" + this.pl)
	}

	_getCol() {
		var e = 12,
		t = "col-12",
		n = this.wrapper.parentNode.parentNode,
		r = new RegExp(/\bcol-.+?\b/, "g");
		if (n.className.match(r)) {
			n.classList.forEach(function (e) {
				e.match(r) && (t = e);
			});
			var a = t.split("-");
			e = parseInt(a[1]);
		}
		return e;
	}

	_getPadding() {
		var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "l",
		t = 0,
		n = "p" + e + "-0",
		r = this.wrapper.parentNode.parentNode,
		a = new RegExp(/\pl-.+?\b/, "g"),
		i = new RegExp(/\pr-.+?\b/, "g"),
		o = new RegExp(/\pt-.+?\b/, "g"),
		c = new RegExp(/\pb-.+?\b/, "g");
		if ("l" == e) {
			if (r.className.match(a)) {
				r.classList.forEach(function (e) {
					e.match(a) && (n = e);
				});
				var s = n.split("-");
				t = parseInt(s[1]);
			}
		} else if ("r" == e) {
			if (r.className.match(i)) {
				r.classList.forEach(function (e) {
					e.match(i) && (n = e);
				});
				var l = n.split("-");
				t = parseInt(l[1]);
			}
		} else if ("t" == e) {
			if (r.className.match(o)) {
				r.classList.forEach(function (e) {
					e.match(o) && (n = e);
				});
				var u = n.split("-");
				t = parseInt(u[1]);
			}
		} else if ("b" == e && r.className.match(c)) {
			r.classList.forEach(function (e) {
				e.match(c) && (n = e);
			});
			var p = n.split("-");
			t = parseInt(p[1]);
		}
		return t;
	}

	_make_fieldgroup(parent, ddf_list) {
		this.card_field = new frappe.ui.FieldGroup({
			"fields": ddf_list,
			"parent": parent
		});
		this.card_field.make();
	}

	_make_cards(card_name) {
		let card = this.config.page_data.cards.items.find(obj => {
			return obj.label == card_name
		});
		this.wrapper.innerHTML = '';
		this.sections = {};
		let cards = new WidgetGroup({
			container: this.wrapper,
			type: "links",
			columns: 3,
			options: {
				// allow_sorting: this.allow_customization,
				allow_create: false,
				allow_delete: false,
				// allow_hiding: this.allow_customization,
				allow_edit: false,
			},
			widgets: card
		});

		this.sections["cards"] = cards;
		this.wrapper.setAttribute("card_name", card_name);
	}
}

class Shortcut {
	static get toolbox() {
		return {
			title: 'Shortcut',
			icon: '<svg height="18" width="18" viewBox="0 0 122.88 115.71"><path d="M116.56 3.69l-3.84 53.76-17.69-15c-19.5 8.72-29.96 23.99-30.51 43.77-17.95-26.98-7.46-50.4 12.46-65.97L64.96 3l51.6.69zM28.3 0h14.56v19.67H32.67c-4.17 0-7.96 1.71-10.72 4.47-2.75 2.75-4.46 6.55-4.46 10.72l-.03 46c.03 4.16 1.75 7.95 4.5 10.71 2.76 2.76 6.56 4.48 10.71 4.48h58.02c4.15 0 7.95-1.72 10.71-4.48 2.76-2.76 4.48-6.55 4.48-10.71V73.9h17.01v11.33c0 7.77-3.2 17.04-8.32 22.16-5.12 5.12-12.21 8.32-19.98 8.32H28.3c-7.77 0-14.86-3.2-19.98-8.32C3.19 102.26 0 95.18 0 87.41l.03-59.1c-.03-7.79 3.16-14.88 8.28-20C13.43 3.19 20.51 0 28.3 0z" fill-rule="evenodd" clip-rule="evenodd"/></svg>'
		};
	}

	static get isReadOnlySupported() {
		return true;
	}

	constructor({data, api, config, readOnly}){
		this.data = data;
		this.api = api;
		this.config = config;
		this.readOnly = readOnly;
		this.sections = {};
		this.col = this.data.col ? this.data.col : "12",
		this.pt = this.data.pt ? this.data.pt : "0",
		this.pr = this.data.pr ? this.data.pr : "0",
		this.pb = this.data.pb ? this.data.pb : "0",
		this.pl = this.data.pl ? this.data.pl : "0"
	}

	render() {
		let me = this;
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('p-2');
		this._make_fieldgroup(this.wrapper, [{
			fieldtype: "Select", 
			label: "Shortcut Name", 
			fieldname: "shortcut_name",
			options: this.config.page_data.shortcuts.items.map(({ label }) => label),
			change: function() {
				if (this.value) {
					me._make_shortcuts(this.value)
				}
			}
		}]);
		if (this.data && this.data.shortcut_name) {
			this._make_shortcuts(this.data.shortcut_name)
		}
		return this.wrapper;
	}

	save(blockContent) {
		return {
			shortcut_name: blockContent.getAttribute('shortcut_name'),
			col: this._getCol(),
			pt: this._getPadding("t"),
			pr: this._getPadding("r"),
			pb: this._getPadding("b"),
			pl: this._getPadding("l")
		}
	}

	rendered() {
		var e = this.wrapper.parentNode.parentNode;
		e.classList.add("col-" + this.col)
		e.classList.add("pt-" + this.pt)
		e.classList.add("pr-" + this.pr)
		e.classList.add("pb-" + this.pb)
		e.classList.add("pl-" + this.pl)
	}

	_getCol() {
		var e = 12,
		t = "col-12",
		n = this.wrapper.parentNode.parentNode,
		r = new RegExp(/\bcol-.+?\b/, "g");
		if (n.className.match(r)) {
			n.classList.forEach(function (e) {
				e.match(r) && (t = e);
			});
			var a = t.split("-");
			e = parseInt(a[1]);
		}
		return e;
	}

	_getPadding() {
		var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "l",
		t = 0,
		n = "p" + e + "-0",
		r = this.wrapper.parentNode.parentNode,
		a = new RegExp(/\pl-.+?\b/, "g"),
		i = new RegExp(/\pr-.+?\b/, "g"),
		o = new RegExp(/\pt-.+?\b/, "g"),
		c = new RegExp(/\pb-.+?\b/, "g");
		if ("l" == e) {
			if (r.className.match(a)) {
				r.classList.forEach(function (e) {
					e.match(a) && (n = e);
				});
				var s = n.split("-");
				t = parseInt(s[1]);
			}
		} else if ("r" == e) {
			if (r.className.match(i)) {
				r.classList.forEach(function (e) {
					e.match(i) && (n = e);
				});
				var l = n.split("-");
				t = parseInt(l[1]);
			}
		} else if ("t" == e) {
			if (r.className.match(o)) {
				r.classList.forEach(function (e) {
					e.match(o) && (n = e);
				});
				var u = n.split("-");
				t = parseInt(u[1]);
			}
		} else if ("b" == e && r.className.match(c)) {
			r.classList.forEach(function (e) {
				e.match(c) && (n = e);
			});
			var p = n.split("-");
			t = parseInt(p[1]);
		}
		return t;
	}

	_make_fieldgroup(parent, ddf_list) {
		this.shortcut_field = new frappe.ui.FieldGroup({
			"fields": ddf_list,
			"parent": parent
		});
		this.shortcut_field.make();
	}

	_make_shortcuts(shortcut_name) {
		let shortcut = this.config.page_data.shortcuts.items.find(obj => {
			return obj.label == shortcut_name
		});
		this.wrapper.innerHTML = '';
		this.sections = {};
		this.sections["shortcuts"] = new WidgetGroup({
			container: this.wrapper,
			type: "shortcut",
			columns: 3,
			options: {
				// allow_sorting: this.allow_customization,
				// allow_create: this.allow_customization,
				// allow_delete: this.allow_customization,
				allow_hiding: false,
				allow_edit: true,
			},
			widgets: shortcut
		});
		this.wrapper.setAttribute("shortcut_name", shortcut_name);
	}
}

class WidgetGroup {
	constructor(opts) {
		Object.assign(this, opts);
		this.widgets_list = [];
		this.widgets_dict = {};
		this.widget_order = [];
		this.make();
	}

	make() {
		this.add_widget(this.widgets);
	}

	add_widget(widget) {
		let widget_object = frappe.widget.make_widget({
			...widget,
			widget_type: this.type,
			container: this.container,
			height: this.height || null,
			options: {
				...this.options,
				on_delete: (name) => this.on_delete(name),
			},
		});

		this.widgets_list.push(widget_object);
		this.widgets_dict[widget.name] = widget_object;

		return widget_object;
	}
}

class MyBlockTune {
	static get isTune() {
		return true;
	}

	constructor({api, settings}) {
		this.api = api;
		this.settings = settings;
		this.CSS = {
			button: 'ce-settings__button',
			wrapper: 'ce-tune-layout',
			sidebar: 'cdx-settings-sidebar',
			animation: 'wobble',
		};
		this.data = { colWidth: 12, pl: 0, pr: 0, pt: 0, pb: 0 };
		this.wrapper = undefined;
		this.sidebar = undefined;
	}

	render() {
		let me = this;
		let layoutWrapper = document.createElement('div');
		layoutWrapper.classList.add(this.CSS.wrapper);
		let decreaseWidthButton = document.createElement('div');
		decreaseWidthButton.classList.add(this.CSS.button);
		let increaseWidthButton = document.createElement('div');
		increaseWidthButton.classList.add(this.CSS.button);
		let paddingButton = document.createElement('div');
		paddingButton.classList.add(this.CSS.button);

		layoutWrapper.appendChild(paddingButton);
		layoutWrapper.appendChild(decreaseWidthButton);
		layoutWrapper.appendChild(increaseWidthButton);

		// paddingButton.appendChild($.svg('padding', 15, 15));
		paddingButton.innerHTML = `<svg version="1.1" height="12" x="0px" y="0px" viewBox="-674 379 17 12" style="enable-background:new -674 379 17 12;" xml:space="preserve"><rect x="-666.1" y="379.9" width="1.7" height="10.3"/><polygon points="-657,384.2 -659.9,384.2 -658.8,383.1 -660,381.9 -663.1,385 -660,388.1 -658.8,386.9 -659.9,385.8 -657,385.8 "/><rect x="-671.9" y="379.9" width="4.1" height="1.7"/><rect x="-674" y="384.2" width="6.1" height="1.7"/><rect x="-671.9" y="388.4" width="4.1" height="1.7"/></svg>`;
		this.api.listeners.on(
			paddingButton,
			'click',
			(event) => me.showPadding(event, paddingButton),
			false
		);

		// decreaseWidthButton.appendChild($.svg('decrease-width', 15, 15));
		decreaseWidthButton.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 380 17 10" style="enable-background:new -674 380 17 10;" xml:space="preserve"><path d="M-674,383.9h3.6l-1.7-1.7c-0.4-0.4-0.4-1.2,0-1.6c0.4-0.4,1.1-0.4,1.6,0l3.2,3.2c0.6,0.2,0.8,0.8,0.6,1.4	c-0.1,0.1-0.1,0.3-0.2,0.4l-3.8,3.8c-0.4,0.4-1.1,0.4-1.5,0c-0.4-0.4-0.4-1.1,0-1.5l1.8-1.8h-3.6V383.9z"/><path d="M-657,386.1h-3.6l1.7,1.7c0.4,0.4,0.4,1.2,0,1.6c-0.4,0.4-1.1,0.4-1.6,0l-3.2-3.2c-0.6-0.2-0.8-0.8-0.6-1.4	c0.1-0.1,0.1-0.3,0.2-0.4l3.8-3.8c0.4-0.4,1.1-0.4,1.5,0c0.4,0.4,0.4,1.1,0,1.5l-1.8,1.8h3.6V386.1z"/></svg>`;
		this.api.listeners.on(
			decreaseWidthButton,
			'click',
			(event) => me.decreaseWidth(event, decreaseWidthButton),
			false
		);

		// increaseWidthButton.appendChild();
		increaseWidthButton.innerHTML = `<svg width="17" height="10" viewBox="0 0 17 10"><path d="M13.568 5.925H4.056l1.703 1.703a1.125 1.125 0 0 1-1.59 1.591L.962 6.014A1.069 1.069 0 0 1 .588 4.26L4.38.469a1.069 1.069 0 0 1 1.512 1.511L4.084 3.787h9.606l-1.85-1.85a1.069 1.069 0 1 1 1.512-1.51l3.792 3.791a1.069 1.069 0 0 1-.475 1.788L13.514 9.16a1.125 1.125 0 0 1-1.59-1.591l1.644-1.644z"/></svg>`;
		this.api.listeners.on(
			increaseWidthButton,
			'click',
			(event) => me.increaseWidth(event, increaseWidthButton),
			false
		);

		this.wrapper = layoutWrapper;
		return layoutWrapper;
	}

	decreaseWidth(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if (currentBlockIndex < 0) {
			return;
		}

		let currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		let currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'col-12';
		let colClass = new RegExp(/\bcol-.+?\b/, 'g');
		if (currentBlockElement.className.match(colClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(colClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let width = parseInt(parts[1]);
			if(width >= 2){
				currentBlockElement.classList.remove('col-'+width);
				width = width - 1;
				currentBlockElement.classList.add('col-'+width);
			}
		}
	}

	increaseWidth(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if (currentBlockIndex < 0) {
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'col-12';
		const colClass = new RegExp(/\bcol-.+?\b/, 'g');
		if (currentBlockElement.className.match(colClass)) {
			currentBlockElement.classList.forEach( cn => {
			if(cn.match(colClass)){
				className = cn;
			}
			});
			let parts = className.split('-');
			let width = parseInt(parts[1]);
			if(width <= 11){
					currentBlockElement.classList.remove('col-'+width);
					width = width + 1;
				currentBlockElement.classList.add('col-'+width);
				}
		}
	}
		
	showPadding(event, button) {
		let me = this;
		if(button.classList.contains('cdx-settings-button--active')){
			this.sidebar.remove();
			button.classList.remove('cdx-settings-button--active');
		} else {
			button.classList.add('cdx-settings-button--active');

			let sidebarWrapper = document.createElement('div');
			sidebarWrapper.classList.add(this.CSS.sidebar);

			let paddingLeftCaption = document.createElement('button');
			paddingLeftCaption.classList.add(this.CSS.button, 'disabled');
			// paddingLeftCaption.appendChild($.svg('arrow-left', 10, 10));
			paddingLeftCaption.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 380 17 10" style="enable-background:new -674 380 17 10;" xml:space="preserve"><polygon points="-659,384.1 -667.8,384.1 -665.8,381.9 -667,380.7 -671,384.9 -667.1,388.9 -665.8,387.7 -667.8,385.7 -659,385.7 	"/></svg>`;

			let paddingRightCaption = document.createElement('button');
			paddingRightCaption.classList.add(this.CSS.button, 'disabled');
			// paddingRightCaption.appendChild($.svg('arrow-right', 10, 10));
			paddingRightCaption.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 380 17 10" style="enable-background:new -674 380 17 10;" xml:space="preserve"><polygon points="-671,385.7 -662.2,385.7 -664.2,387.7 -662.9,388.9 -659,384.9 -663,380.7 -664.2,381.9 -662.2,384.1 -671,384.1 	"/></svg>`;

			let paddingTopCaption = document.createElement('button');
			paddingTopCaption.classList.add(this.CSS.button, 'disabled');
			// paddingTopCaption.appendChild($.svg('arrow-up', 10, 10));
			paddingTopCaption.innerHTML = `<svg version="1.1" height="13" x="0px" y="0px" viewBox="-674 378.5 17 13" style="enable-background:new -674 378.5 17 13;" xml:space="preserve"><polygon points="-664.6,391 -664.6,382.2 -662.6,384.2 -661.4,382.9 -665.4,379 -669.6,383 -668.4,384.2 -666.2,382.2 -666.2,391 	"/></svg>`;

			let paddingBottomCaption = document.createElement('button');
			paddingBottomCaption.classList.add(this.CSS.button, 'disabled');
			// paddingBottomCaption.appendChild($.svg('arrow-down', 10, 10));
			paddingBottomCaption.innerHTML = `<svg version="1.1" height="13" x="0px" y="0px" viewBox="-674 378.5 17 13" style="enable-background:new -674 378.5 17 13;" xml:space="preserve"><polygon points="-666.2,379 -666.2,387.8 -668.4,385.8 -669.6,387 -665.4,391 -661.4,387.1 -662.6,385.8 -664.6,387.8 -664.6,379 	"/></svg>`;

			let increasePaddingLeft = document.createElement('button');
			increasePaddingLeft.classList.add(this.CSS.button);

			let decreasePaddingLeft = document.createElement('button');
			decreasePaddingLeft.classList.add(this.CSS.button);

			let increasePaddingRight = document.createElement('button');
			increasePaddingRight.classList.add(this.CSS.button);

			let decreasePaddingRight = document.createElement('button');
			decreasePaddingRight.classList.add(this.CSS.button);

			let increasePaddingTop = document.createElement('button');
			increasePaddingTop.classList.add(this.CSS.button);

			let decreasePaddingTop = document.createElement('button');
			decreasePaddingTop.classList.add(this.CSS.button);

			let increasePaddingBottom = document.createElement('button');
			increasePaddingBottom.classList.add(this.CSS.button);

			let decreasePaddingBottom = document.createElement('button');
			decreasePaddingBottom.classList.add(this.CSS.button);

			this.sidebar = sidebarWrapper;

			// Left Padding
			sidebarWrapper.appendChild(paddingLeftCaption);

			// increasePaddingLeft.appendChild($.svg('plus', 15, 15));
			increasePaddingLeft.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-664.7,388.5 -664.7,381.5 -666.3,381.5 -666.3,388.5 "/><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				increasePaddingLeft,
				'click',
				(event) => me.increasePaddingLeft(event, increasePaddingLeft),
				false
			);
			sidebarWrapper.appendChild(increasePaddingLeft);

			// decreasePaddingLeft.appendChild($.svg('minus', 15, 15));
			decreasePaddingLeft.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				decreasePaddingLeft,
				'click',
				(event) => me.decreasePaddingLeft(event, decreasePaddingLeft),
				false
			);
			sidebarWrapper.appendChild(decreasePaddingLeft);

			// Right Padding
			sidebarWrapper.appendChild(paddingRightCaption);
			// increasePaddingRight.appendChild($.svg('plus', 15, 15));
			increasePaddingRight.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-664.7,388.5 -664.7,381.5 -666.3,381.5 -666.3,388.5 "/><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				increasePaddingRight,
				'click',
				(event) => me.increasePaddingRight(event, increasePaddingRight),
				false
			);
			sidebarWrapper.appendChild(increasePaddingRight);

			// decreasePaddingRight.appendChild($.svg('minus', 15, 15));
			decreasePaddingRight.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				decreasePaddingRight,
				'click',
				(event) => me.decreasePaddingRight(event, decreasePaddingRight),
				false
			);
			sidebarWrapper.appendChild(decreasePaddingRight);

			// Top Padding
			sidebarWrapper.appendChild(paddingTopCaption);
			// increasePaddingTop.appendChild($.svg('plus', 15, 15));
			increasePaddingTop.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-664.7,388.5 -664.7,381.5 -666.3,381.5 -666.3,388.5 "/><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				increasePaddingTop,
				'click',
				(event) => me.increasePaddingTop(event, increasePaddingTop),
				false
			);
			sidebarWrapper.appendChild(increasePaddingTop);

			// decreasePaddingTop.appendChild($.svg('minus', 15, 15));
			decreasePaddingTop.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				decreasePaddingTop,
				'click',
				(event) => me.decreasePaddingTop(event, decreasePaddingTop),
				false
			);
			sidebarWrapper.appendChild(decreasePaddingTop);

			// Bottom Padding
			sidebarWrapper.appendChild(paddingBottomCaption);
			// increasePaddingBottom.appendChild($.svg('plus', 15, 15));
			increasePaddingBottom.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-664.7,388.5 -664.7,381.5 -666.3,381.5 -666.3,388.5 "/><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				increasePaddingBottom,
				'click',
				(event) => me.increasePaddingBottom(event, increasePaddingBottom),
				false
			);
			sidebarWrapper.appendChild(increasePaddingBottom);

			// decreasePaddingBottom.appendChild($.svg('minus', 15, 15));
			decreasePaddingBottom.innerHTML = `<svg version="1.1" height="10" x="0px" y="0px" viewBox="-674 381.5 17 7" style="enable-background:new -674 381.5 17 7;" xml:space="preserve"><polygon points="-669,385.8 -662,385.8 -662,384.2 -669,384.2 "/></svg>`;

			this.api.listeners.on(
				decreasePaddingBottom,
				'click',
				(event) => me.decreasePaddingBottom(event, decreasePaddingBottom),
				false
			);
			sidebarWrapper.appendChild(decreasePaddingBottom);

			this.wrapper.appendChild(sidebarWrapper);
		}
	}

	increasePaddingLeft(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pl-0';
		const paddingClass = new RegExp(/\pl-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding <= 4){
				currentBlockElement.classList.remove('pl-'+padding);
				padding = padding + 1;
				currentBlockElement.classList.add('pl-'+padding);
			}
		}

	}

	decreasePaddingLeft(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pl-0';
		const paddingClass = new RegExp(/\pl-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding >= 1){
				currentBlockElement.classList.remove('pl-'+padding);
				padding = padding - 1;
				currentBlockElement.classList.add('pl-'+padding);
			}
		}
	}

	increasePaddingRight(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pr-0';
		const paddingClass = new RegExp(/\pr-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding <= 4){
				currentBlockElement.classList.remove('pr-'+padding);
				padding = padding + 1;
				currentBlockElement.classList.add('pr-'+padding);
			}
		}
	}

	decreasePaddingRight(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pr-0';
		const paddingClass = new RegExp(/\pr-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding >= 1){
				currentBlockElement.classList.remove('pr-'+padding);
				padding = padding - 1;
				currentBlockElement.classList.add('pr-'+padding);
			}
		}
	}

	increasePaddingTop(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pt-0';
		const paddingClass = new RegExp(/\pt-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding <= 4){
				currentBlockElement.classList.remove('pt-'+padding);
				padding = padding + 1;
				currentBlockElement.classList.add('pt-'+padding);
			}
		}
	}

	decreasePaddingTop(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pt-0';
		const paddingClass = new RegExp(/\pt-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding >= 1){
				currentBlockElement.classList.remove('pt-'+padding);
				padding = padding - 1;
				currentBlockElement.classList.add('pt-'+padding);
			}
		}
	}

	increasePaddingBottom(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pb-0';
		const paddingClass = new RegExp(/\pb-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding <= 4){
				currentBlockElement.classList.remove('pb-'+padding);
				padding = padding + 1;
				currentBlockElement.classList.add('pb-'+padding);
			}
		}
	}

	decreasePaddingBottom(event, button) {
		const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();

		if(currentBlockIndex < 0){
			return;
		}

		const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);
		if (!currentBlock){
			return;
		}

		const currentBlockElement = currentBlock.holder;

		// let block = this.api.blocks.getBlock(currentBlockElement);
		let className = 'pb-0';
		const paddingClass = new RegExp(/\pb-.+?\b/, 'g');
		if (currentBlockElement.className.match(paddingClass)) {
			currentBlockElement.classList.forEach( cn => {
				if(cn.match(paddingClass)){
					className = cn;
				}
			});
			let parts = className.split('-');
			let padding = parseInt(parts[1]);
			if(padding >= 1){
				currentBlockElement.classList.remove('pb-'+padding);
				padding = padding - 1;
				currentBlockElement.classList.add('pb-'+padding);
			}
		}
	}
}
