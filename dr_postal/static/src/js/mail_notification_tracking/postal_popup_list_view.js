/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";

const baseListViewProps = listView.props;

const drPostalPopupListView = {
    ...listView,
    props(genericProps, view) {
        const props = baseListViewProps(genericProps, view);
        return {
            ...props,
            allowSelectors: false,
            display: {
                ...props.display,
                controlPanel: false,
                searchPanel: false,
            },
        };
    },
};

registry.category("views").add("dr_postal_popup_list", drPostalPopupListView);

