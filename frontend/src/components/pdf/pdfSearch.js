
export async function extractTextFromPDF(pdfDoc) {
    const pagesText = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(" ");
        pagesText.push({ pageNum: i, text, items: textContent.items });
    }
    return pagesText;
}



export function searchInText(pagesText, query) {
    if (!query || query.length < 2) return [];
    const matches = [];
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    pagesText.forEach(({ pageNum, text }) => {
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                pageNum,
                start: match.index,
                end: match.index + query.length,
                text: match[0],
            });
        }
    });
    return matches;
}
