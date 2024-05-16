const fs = require('fs');

// Function to convert CSS custom properties to Android colors XML
function convertCSStoXML(cssFilePath) {
    const customProperties = {};
    const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
    const lines = cssContent.split('\n');

    lines.forEach(line => {
        if (line.trim().startsWith('--')) {
            const [property, value] = line.split(':').map(item => item.trim());
            const propertyName = property.substring(2); // Remove '--'
            customProperties[propertyName] = value;
        }
    });

    // Generate Android colors XML
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
    Object.keys(customProperties).forEach(propertyName => {
        xml += `\t<color name="${propertyName}">${customProperties[propertyName].toUpperCase()}</color>\n`;
    });
    xml += '</resources>';

    return xml;
}

// Main function
function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error('Usage: node cssToColorsXML.js <input-css-file> <output-xml-file>');
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
    console.log(`Android colors XML file generated: ${outputFilePath}`);
}

// Execute main function
main();
