const fs = require('fs');
const css = require('css');

const BASE_FONT_SIZE = 16; // px
const ROOT_FONT_SIZE = 12; // px

function isClass(line) {
    return line.startsWith('.');
}

function hasCombinators(line) {
    return line.includes('+') || line.includes('>') || line.includes(' ');
}

function hasPseudoClassesOrPseudoElements(line) {
    return line.includes(':');
}

function hasAttributeSelectors(line) {
    return line.includes('[');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function camelize(string) {
    return string.replace(/-./g, x=>x[1].toUpperCase());
}

function replaceCssVariables(cssVariables, string) {
    if (!string) {
        return "";
    }
    if (!string.includes("var(")) {
        return string;
    }
    const arguments = string.split(" ");
    return arguments.map((argument) => {
        if (argument.startsWith("var(")) {
            const key = argument.replace("var(", "").replace(")", "");
            return replaceCssVariables(cssVariables, cssVariables[key]);
        }
        return argument;
    }).join(" ");
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
    const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
    const parsedCSS = css.parse(cssContent);

    const cssVariables = {};
    const styles = new Map();

    parsedCSS.stylesheet.rules.forEach((rule) => {
        if (rule.type === 'rule') {
            rule.selectors.forEach((selector) => {
                const androidStyle = convertSelectorToAndroidStyle(selector);
                if (androidStyle) {
                    rule.declarations.forEach((declaration) => {
                        if (declaration.property.startsWith('--')) {
                            if (declaration.value.startsWith('var(')) {
                                cssVariables[declaration.property] = replaceCssVariables(cssVariables, declaration.value);
                            }
                            cssVariables[declaration.property] = declaration.value;
                            return;
                        }
                        else if (declaration.value.includes('auto') || declaration.value.includes('calc') || declaration.value.includes('inherit')) {
                            console.log("Skipped rule", declaration.property, declaration.value);
                            return;
                        }
                        
                        const androidProperty = convertCSSPropertyToAndroid(declaration.property, replaceCssVariables(cssVariables, declaration.value));
                        if (androidProperty) {
                            if (!styles.has(androidStyle)) {
                                styles.set(androidStyle, []);
                            }
                            styles.get(androidStyle).push(androidProperty);
                        }
                    });
                }
            });
        }
    });
    const xmlContent = generateStylesXML(styles);
    return xmlContent;
}

function convertSelectorToAndroidStyle(selector) {
    // Convert CSS selector to Android style name
    if (!hasAttributeSelectors(selector) && !hasCombinators(selector) && !hasPseudoClassesOrPseudoElements(selector)) {
        if (isClass(selector)) {
            return selector.substring(1);
        }
        return capitalizeFirstLetter(selector);
    }
    else if (selector === ':root') {
        return selector;
    }
    console.log("Skipped selector", selector);
    return null;
}

function generateStylesXML(styles) {
    let xmlContent = '<resources>\n';

    styles.forEach((properties, styleName) => {
        xmlContent += `\t<style name="${camelize(styleName)}">\n`;
        properties.forEach(property => {
            const shouldCommentOut = property.toLowerCase().includes("var(--");
            if (shouldCommentOut) {
                xmlContent += '<!--';
                property = property.replaceAll("--", "");
            }
            xmlContent += `\t\t${property}\n`;
            if (shouldCommentOut) {
                xmlContent += '-->';
            }
        });
        xmlContent += '\t</style>\n';
    });

    xmlContent += '</resources>';
    return xmlContent;
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
