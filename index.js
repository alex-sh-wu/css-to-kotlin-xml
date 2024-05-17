const fs = require('fs');

const BASE_FONT_SIZE = 16; // px
const ROOT_FONT_SIZE = 12; // px

function isClass(line) {
    return line.trim().startsWith('.');
}

function isHtmlTag(line) {
    return line.includes('{') && !line.includes('[');
}

function isStyle(line) {
    return line.includes(':');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function ensureExists(object, property) {
    if (!object[property]) {
        object[property] = {};
    }
}

function camelize(string) {
    return string.replace(/-./g, x=>x[1].toUpperCase());
}

function removePx(string) {
    return string.replace("px", "");
}

function removeRem(string) {
    return string.replace("rem", "");
}

function removeEm(string) {
    return string.replace('em', "");
}

// Convert em to pixels
function emToPixels(emValue, baseFontSize) {
    return Math.round(emValue * baseFontSize);
}

// Convert rem to pixels
function remToPixels(remValue, rootFontSize) {
    return Math.round(remValue * rootFontSize);
}

function convertUnits(string) {
    if (string === 'auto') return 0;
    if (string.includes('px')) {
        return parseInt(removePx(string));
    }
    else if (string.includes('rem')) {
        return remToPixels(parseFloat(removeRem(string)), ROOT_FONT_SIZE);
    }
    else if (string.includes('em')) {
        return emToPixels(parseFloat(removeEm(string)), BASE_FONT_SIZE);
    }
    return parseInt(string);
}

// Function to convert CSS class selector to Android style XML
function convertCSStoXML(cssFilePath) {
    const styles = {};
    const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
    const lines = cssContent.split('\n');
    let currentClassName = '';

    lines.forEach(line => {
        if (isClass(line)) {
            currentClassName = line.split('{')[0].trim().substring(1);
            ensureExists(styles, currentClassName);
        }
        else if (isHtmlTag(line)) {
            currentClassName = capitalizeFirstLetter(line.split('{')[0].trim());
            ensureExists(styles, currentClassName);
        }
        else if (isStyle(line)) {
            const [property, value] = line.split(':').map(item => item.trim());
            if (currentClassName && property && value) {
                styles[currentClassName][property] = value.slice(0, -1);
            }
        }
    });

    // Generate Android styles XML
    let xml = '<resources>\n';
    Object.keys(styles).forEach(className => {
        if ([':', ',', '>'].find((character) => className.includes(character))) {
            return; // ignore css styles for states e.g. :hover
        }
        xml += `\t<style name="${className.replaceAll("-", "_")}">\n`;
        Object.keys(styles[className]).forEach(property => {
            let value = styles[className][property];
            const shouldCommentOut = value.includes("var(--") || value.includes("auto");
            if (shouldCommentOut) {
                value = value.replaceAll("var(--", "");
            }
            const androidAttribute = convertCSSPropertyToAndroid(property, value);
            if (androidAttribute) {
                if (shouldCommentOut) {
                    xml += '<!--';
                }
                xml += `\t\t${androidAttribute}\n`;
                if (shouldCommentOut) {
                    xml += '-->';
                }
            }
        });
        xml += '\t</style>\n';
    });
    xml += '</resources>';

    return xml;
}

// Function to convert CSS property to Android style attribute
function convertCSSPropertyToAndroid(property, value) {
    value = value.replaceAll(" !important", "");
    switch (property) {
        case 'color':
            return `<item name="android:textColor">${value.toUpperCase()}</item>`;
        case 'font-size':
            return `<item name="android:textSize">${convertUnits(value)}sp</item>`;
        case 'font-weight':
            return `<item name="android:textStyle">${value}</item>`;
        case 'font-family':
            return `<item name="android:fontFamily">${value}</item>`;
        case 'background-color':
            return `<item name="android:background">${value}</item>`;
        case 'text-decoration':
            const supportedTextDecorations = {
                "underline": "Underline",
                "line-through": "LineThrough",
            };
            const supportedValue = supportedTextDecorations[value];
            if (supportedValue) {
                return `<item name="android:textDecoration">${supportedValue}</item>`;
            }
            break;
        case 'padding':
        case 'margin':
            const propertyMap = {
                'padding': 'padding',
                'margin': 'layout_margin'
            };
            const arguments = value.split(" ");
            if (arguments.length === 1) {
                return `<item name="android:${propertyMap[property]}">${convertUnits(value)}sp</item>`;
            }
            else if (arguments.length === 2) {
                return `<item name="android:${propertyMap[property]}Top">${convertUnits(arguments[0])}sp</item><item name="android:${propertyMap[property]}Right">${convertUnits(arguments[1])}sp</item><item name="android:${propertyMap[property]}Bottom">${convertUnits(arguments[0])}sp</item><item name="android:${propertyMap[property]}Left">${convertUnits(arguments[1])}sp</item>`;
            }
            else if (arguments.length === 3) {
                return `<item name="android:${propertyMap[property]}Top">${convertUnits(arguments[0])}sp</item><item name="android:${propertyMap[property]}Right">${convertUnits(arguments[1])}sp</item><item name="android:${propertyMap[property]}Bottom">${convertUnits(arguments[2])}sp</item><item name="android:${propertyMap[property]}Left">${convertUnits(arguments[1])}sp</item>`;
            }
            else if (arguments.length === 4) {
                return `<item name="android:${propertyMap[property]}Top">${convertUnits(arguments[0])}sp</item><item name="android:${propertyMap[property]}Right">${convertUnits(arguments[1])}sp</item><item name="android:${propertyMap[property]}Bottom">${convertUnits(arguments[2])}sp</item><item name="android:${propertyMap[property]}Left">${convertUnits(arguments[3])}sp</item>`;
            }
            break;
        case 'padding-left':
        case 'padding-top':
        case 'padding-bottom':
        case 'padding-right':
            return `<item name="android:${camelize(property)}">${convertUnits(value)}sp</item>`;
        case 'margin-left':
        case 'margin-top':
        case 'margin-bottom':
        case 'margin-right':
            return `<item name="android:layout_${camelize(property)}">${convertUnits(value)}sp</item>`;
        case 'width':
            if (value.includes('%')) {
                const widthInPercent = value.replace('%', '');
                const roundedWidth = Math.round(parseInt(widthInPercent));
                return `<item name="android:layout_width">0dp</item>\n\t\t<item name="android:layout_weight">.${roundedWidth}</item>`;
            }
            return `<item name="android:layout_width">${convertUnits(value)}dp</item>`;
        // Add more cases for other CSS properties you want to support
        default:
            return null;
    }
}

// Main function
function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error('Usage: node cssToStylesXML.js <input-css-file> <output-xml-file>');
        process.exit(1);
    }

    const inputFilePath = args[0];
    const outputFilePath = args[1];

    if (!fs.existsSync(inputFilePath)) {
        console.error(`Input CSS file '${inputFilePath}' not found.`);
        process.exit(1);
    }

    const outputXML = convertCSStoXML(inputFilePath);
    fs.writeFileSync(outputFilePath, outputXML);
    console.log(`Android styles XML file generated: ${outputFilePath}`);
}

// Execute main function
main();
