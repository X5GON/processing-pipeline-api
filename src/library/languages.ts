// interfaces
import * as INT from "../Interfaces";

// config
import * as languages from "../config/languages.json";

export default class Languages {

    private _idx_alpha2: INT.IGenericJSON;
    private _idx_alpha3: INT.IGenericJSON;
    private _idx_fullname: INT.IGenericJSON;

    constructor() {
        this._idx_alpha2 = {};
        this._idx_alpha3 = {};
        this._idx_fullname = {};
        for (let i = 0; i < languages.length; i++) {
            const language = languages[i];
            this._idx_alpha2[language.alpha2] = i;
            this._idx_alpha3[language.alpha3] = i;
            this._idx_fullname[language.fullname] = i;
        }
    }

    // get the code type
    getCodeType(value: string) {
        switch(value.length) {
        case 2:
            return INT.ILanguageTypes.ALPHA2;
        case 3:
            return INT.ILanguageTypes.ALPHA3;
        default:
            return INT.ILanguageTypes.FULLNAME;
        }
    }

    // get the code mapping
    getCodeMapping(type: INT.ILanguageTypes) {
        switch(type) {
        case INT.ILanguageTypes.ALPHA2:
            return this._idx_alpha2;
        case INT.ILanguageTypes.ALPHA3:
            return this._idx_alpha3;
        default:
            return this._idx_fullname;
        }
    }

    // get the iso code in the target type
    getIsoCode(source: string, targetType: INT.ILanguageTypes) {
        // get the value type based on their length
        const sourceType = this.getCodeType(source);
        // checks if the value type is the same as the target type
        if (sourceType === targetType) { return source; }
        // get the source mapping
        const sourceMapping = this.getCodeMapping(sourceType);
        // get the source index and use it to get the target type value
        const idx = sourceMapping[source];
        return languages[idx][targetType];
    }
}