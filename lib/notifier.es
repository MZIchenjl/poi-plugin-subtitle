import {Loader} from './loader';
import _ from 'lodash';
import {EXTRA_CATEGORIES} from './constant';
import {debug, timeToNextHour} from './util';
import {I18nService} from './i18n';
import {Traditionalized} from './traditionalized';
const {getStore} = window;

export class Notifier {

    _shipGraph = {};
    _subtitles = {};
    _voiceMap = {};
    _timeoutHandle = -1;
    _loader = new Loader();
    _i18nService = new I18nService();
    __ = (x) => x;
    ___ = (x) => x;

    constructor() {
    }

    initialize = () => {
        this._ships = getStore('const.$ships');
        this._shipGraph = this._loader.getShipGraph();                       // Load ship graph data
        this._voiceMap = this._loader.getVoiceMap();
        if (_.isEmpty(this._shipGraph)) return;
        this._loader.getSubtitles().then((data) => {
            console.log('Ship quote data: ', data);
            this._subtitles.ships = data;
        });
        for (let category of EXTRA_CATEGORIES) {
            this._subtitles[category] = this._loader.getExtraSubtitles(category);
        }
        [this.__, this.___] = this._i18nService.initialize();
    };

    handleResponseDetails = (event) => {
        const match = /kcs\/sound\/(.*?)\/(.*?).mp3/.exec(event.newURL);
        if (match && match.length == 3) {
            debug(event.newURL);
            const [,shipCode, filename] = match;
            switch (shipCode) {
                case 'kc9998':
                    this._handleExtraVoice('enemies', filename);
                    break;
                case 'kc9999':
                    this._handleExtraVoice('npc', filename);
                    break;
                case 'titlecall':
                    this._handleExtraVoice('titlecall', filename.replace('/', ''));
                    break;
                default:
                    this._handleShipVoice(shipCode, filename);
            }
        }
    };

    handleGameResponse = (event) => {
        clearTimeout(this._timeoutHandle);
    };

    _handleShipVoice = (shipCode, filename) => {
        const apiId = this._shipGraph[shipCode.slice(2)];
        if (!apiId) return;
        const voiceId = this._voiceMap[apiId][filename];
        if (!voiceId) return;
        debug(`apiId: ${apiId}, voiceId: ${voiceId}`);
        let subtitles = this._subtitles['ships'];
        const quote = subtitles['zh-CN'][apiId][voiceId];
        const {__, ___} = this;
        debug(`i18n: ${___(apiId+'.'+voiceId)}`);
        let priority = 5;
        if (voiceId > 8 && voiceId < 11)
            priority = 0;
        const shipName = this._ships[apiId].api_name;
        if (voiceId < 30) {
            if (!quote) {
                this._display(__('Subtitle Miss', shipName), priority);
                return;
            }
            this._display(`${shipName}: ${___(apiId + '.' + voiceId)}`, priority);
        } else {
            const scheduledTime = timeToNextHour();
            this._timeoutHandle = setTimeout(() => {
                if (!quote) {
                    this._display(__('Subtitle Miss', shipName), priority);
                    return;
                }
                this._display(`${shipName}: ${___(apiId + '.' + voiceId)}`, priority);
            }, scheduledTime);
        }
    };

    _handleExtraVoice = (category, voiceId) => {
        const subtitles = this._subtitles[category];
        const title = _.capitalize(category);
        const locale = this._i18nService._locale;
        if (!subtitles[voiceId]) {
            debug(`${title} subtitle missed: #${voiceId}`);
            return;
        }
        const entity = subtitles[voiceId];
        const name = entity.name;
        let quote = entity.jp;
        if (locale == 'zh-CN')
            quote = entity.zh;
        else if (locale == 'zh-TW')
            quote = Traditionalized(entity.zh);
        if (!quote) {
            debug(`${title} subtitle missed: #${voiceId}`);
            return;
        }
        if (name)
            this._display(`${name}: ${quote}`);
        else
            this._display(`${quote}`);
    };

    _display = (text, priority=5, stickyFor=5000) => {
        window.log(text, {priority, stickyFor});
    };
}

