import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

let provider = null;
let searchEngineUrls = null;
let searchEngineIcons = null;
let gsettings = null;

const RESOURCE_PATH = GLib.uri_resolve_relative(
    import.meta.url, 'resources/search-icons', GLib.UriFlags.NONE);

class SearchProvider {
    constructor() {
    }

    get appInfo() {
        return null;
    }

    get canLaunchSearch() {
        return true;
    }

    get id() {
        return 'paperwm-web-search';
    }

    activateResult(_result, terms) {
        const context = new Gio.AppLaunchContext;
        const engine = gsettings.get_int('search-engine');
        const query = terms.join(' ');

        const urlRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/;
        const match = query.match(urlRegex);
        let cmd = 'xdg-open ';

        if (match && match[0].length === query.length) {
            cmd += query.startsWith('http') ? query : `https://${query}`;
        } else {
            cmd += `"${searchEngineUrls[engine]}${terms.join('+')}"`;
        }
        Gio.AppInfo.create_from_commandline(cmd, null, 2).launch([], context);
    }

    launchSearch(_terms) {
        return null;
    }

    createResultObject(_meta) {
        return null;
    }

    getResultMetas(results, _cancellable = null) {
        const engine = gsettings.get_int('search-engine');
        const gicon = Gio.icon_new_for_string(
            `${RESOURCE_PATH}/${searchEngineIcons[engine]}`);
        const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);

        return new Promise(resolve => {
            const resultMetas = results.map(id => ({
                id,
                name: 'Web Search',
                description: 'Launch web search',
                createIcon: size => new St.Icon({
                    gicon,
                    width: size * scaleFactor,
                    height: size * scaleFactor,
                    icon_size: size * scaleFactor,
                }),
            }));
            resolve(resultMetas);
        });
    }

    getInitialResultSet(_terms, _cancellable = null) {
        return new Promise(resolve => resolve(['Web Search']));
    }

    getSubsearchResultSet(results, terms, cancellable = null) {
        return this.getInitialResultSet(terms, cancellable);
    }

    filterResults(results, maxResults) {
        return results.length <= maxResults ? results : results.slice(0, maxResults);
    }
}

function loadSearchEngines() {
    const decoder = new TextDecoder();
    const file = Gio.File.new_for_uri(
        GLib.uri_resolve_relative(import.meta.url, 'search-engines.json', GLib.UriFlags.NONE));
    const [, contents] = file.load_contents(null);
    const json = JSON.parse(decoder.decode(contents));
    searchEngineUrls = json.map(d => d.url);
    searchEngineIcons = json.map(d => d.icon);
}

export function enableQuickSearch(settings) {
    gsettings = settings;
    loadSearchEngines();
    provider = new SearchProvider();
    Main.overview.searchController.addProvider(provider);
}

export function disableQuickSearch() {
    if (provider) {
        Main.overview.searchController.removeProvider(provider);
        provider = null;
    }
    searchEngineUrls = null;
    searchEngineIcons = null;
    gsettings = null;
}
