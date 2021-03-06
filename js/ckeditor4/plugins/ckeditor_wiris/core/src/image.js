import Configuration from './configuration.js';
import Util from './util.js';

/**
 * This class contains all the logic related to image manipulation.
 */
export default class Image {
    /**
     * Clone Wirisformula attributes from 'originImg' to 'destImg'.
     * @param {HTMLImageElement} originImg - formula to copy to 'destImg'. Is a Wirisformula.
     * @param {HTMLImageElement} destImg - formula where 'destImg' copies. Is a Wirisformula.
     */
    static clone(originImg, destImg) {
        const customEditorAttributeName = 'data-custom-editor';
        if (!originImg.hasAttribute(customEditorAttributeName)) {
            destImg.removeAttribute(customEditorAttributeName);
        }

        const mathmlAttributeName = Configuration.get('imageMathmlAttribute');
        const imgAttributes = [
            mathmlAttributeName,
            customEditorAttributeName,
            'alt',
            'height',
            'width',
            'style',
            'src',
            'role'
        ];

        for (const iterator of imgAttributes) {
            const originAttribute = originImg.getAttribute(iterator);
            if (originAttribute) {
                destImg.setAttribute(iterator, originAttribute);
            }
        }
    }

    /**
    * Calculates the metrics of an img dom object given the response URI.
    * @param {Object} img - DOM image object.
    * @param {string} uri - URI generated by the image service: can be a data URI scheme or a URL.
    * @param {boolean} jsonResponse - indicates if the response of the image service is a JSON object.
    */
    static setImgSize(img, uri, jsonResponse) {
        if (jsonResponse) {
            // Cleaning data:image/png;base64.
            if (Configuration.get('imageFormat') == 'svg') {
                // SVG format.
                // If SVG is encoded in base64 we need to convert the base64 bytes into a SVG string.
                if (Configuration.get('saveMode') != 'base64') {
                    var ar = Image.getMetricsFromSvgString(uri);
                } else {
                    var base64String = img.src.substr( img.src.indexOf('base64,') + 7, img.src.length);
                    var svgString = '';
                    var bytes = Util.b64ToByteArray(base64String, base64String.length);
                    for (var i = 0; i < bytes.length; i++) {
                        svgString += String.fromCharCode(bytes[i]);
                    }
                    var ar = Image.getMetricsFromSvgString(svgString);
                }
                // PNG format: we store all metrics information in the first 88 bytes.
            } else {
                var base64String = img.src.substr( img.src.indexOf('base64,') + 7, img.src.length);
                var bytes = Util.b64ToByteArray(base64String, 88);
                var ar = Image.getMetricsFromBytes(bytes);
            }
            // Backwards compatibility: we store the metrics into createimage response.
        } else {
            var ar = Util.urlToAssArray(uri);
        }
        var width = ar['cw'];
        if (!width) {
            return;
        }
        var height = ar['ch'];
        var baseline = ar['cb'];
        var dpi = ar['dpi'];
        if (dpi) {
            width = width * 96 / dpi;
            height = height * 96 / dpi;
            baseline = baseline * 96 / dpi;
        }
        img.width = width;
        img.height = height;
        img.style.verticalAlign = "-" + (height - baseline) + "px";
    }

    /**
     * Re-calculates the metrics of a image which has been resized.
     * @param {Object} img  - DOM image object.
     */
    static fixAfterResize(img) {
        img.removeAttribute('style');
        img.removeAttribute('width');
        img.removeAttribute('height');
        // In order to avoid resize with max-width css property.
        img.style.maxWidth = 'none';
        if (img.src.indexOf("data:image") != -1) {
            if (Configuration.get('imageFormat') == 'svg') {
                // ...data:image/svg+xml;charset=utf8, = 32.
                var svg = decodeURIComponent(img.src.substring(32, img.src.length))
                Image.setImgSize(img, svg, true);
            } else {
                // ...data:image/png;base64, == 22.
                var base64 = img.src.substring(22,img.src.length);
                Image.setImgSize(img, base64, true);
            }
        } else {
            Image.setImgSize(img,img.src);
        }

    }

    /**
     * Returns the metrics (height, width and baseline) contained in SVG image generated
     * by the MathType image service. This image contains as an extra attribute the image baseline (wrs:baseline).
     * @param {string} svgString - a string containing an svg image.
     * @return {Object[]} - Array object containing the image metrics.
     */
    static getMetricsFromSvgString(svgString) {
        var first = svgString.indexOf('height="');
        var last = svgString.indexOf('"',first + 8, svgString.length);
        var height = svgString.substring(first + 8, last);

        first = svgString.indexOf('width="');
        last = svgString.indexOf('"',first + 7, svgString.length);
        var width = svgString.substring(first + 7, last);

        first = svgString.indexOf('wrs:baseline="');
        last = svgString.indexOf('"',first + 14, svgString.length);
        var baseline = svgString.substring(first + 14, last);

        if (typeof(width != 'undefined')) {
            var arr = new Array();
            arr['cw'] = width;
            arr['ch'] = height;
            if (typeof baseline != 'undefined') {
                arr['cb'] = baseline
            }

            return arr;
        }
    }

    /**
     * Get metrics (width, height, baseline and dpi) from a png byte array.
     * @param  {Object[]} bytes - png byte array.
     * @return {Object[]} a array containing the png metrics.
     * @static
     */
    static getMetricsFromBytes(bytes) {
        Util.readBytes(bytes, 0, 8);
        var alloc = 10;
        var i = 0;
        while (bytes.length >= 4) {
            var len = Util.readInt32(bytes);
            var typ = Util.readInt32(bytes);
            if (typ == 0x49484452) {
                var width = Util.readInt32(bytes);
                var height = Util.readInt32(bytes);
                // Read 5 bytes.
                Util.readInt32(bytes);
                Util.readByte(bytes);
            } else if (typ == 0x62615345) { // Baseline: 'baSE'.
                var baseline = Util.readInt32(bytes);
            } else if (typ == 0x70485973) { // Dpis: 'pHYs'.
                var dpi = Util.readInt32(bytes);
                dpi = (Math.round(dpi / 39.37));
                Util.readInt32(bytes);
                Util.readByte(bytes);
            }
            Util.readInt32(bytes);
        }

        if (typeof width != 'undefined') {
            var arr = new Array();
            arr['cw'] = width;
            arr['ch'] = height;
            arr['dpi'] = dpi;
            if (baseline) {
                arr['cb'] = baseline;
            }

            return arr;
        }
    }
}