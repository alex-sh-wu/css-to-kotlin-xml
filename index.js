const fs = require('fs');

function isClass(line) {
    return line.trim().startsWith('.');
}

function isHtmlTag(line) {
    return line.includes('{');
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
        xml += `\t<style name="${className}">\n`;
        Object.keys(styles[className]).forEach(property => {
            const value = styles[className][property];
            const androidAttribute = convertCSSPropertyToAndroid(property, value);
            if (androidAttribute) {
                xml += `\t\t${androidAttribute}\n`;
            }
        });
        xml += '\t</style>\n';
    });
    xml += '</resources>';

    return xml;
}

// Function to convert CSS property to Android style attribute
function convertCSSPropertyToAndroid(property, value) {
    switch (property) {
        case 'color':
            return `<item name="android:textColor">${value.toUpperCase()}</item>`;
        case 'font-size':
            return `<item name="android:textSize">${value.replace("px", "sp")}</item>`;
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
