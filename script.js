// URLs לקבצי המילון ב-GitHub
const HEBREW_DICT_URL = 'https://raw.githubusercontent.com/stain11111111/Hebrew-Text-Corrector-New/main/hebrewDictionary.json';
const COMMON_TYPOS_URL = 'https://raw.githubusercontent.com/stain11111111/Hebrew-Text-Corrector-New/main/commonTypos.json';

let hebrewDictionary = new Set();
let commonTypos = {};

// אלמנטים מה-DOM
const inputText = document.getElementById('inputText');
const fixButton = document.getElementById('fixButton');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');
const outputTextDisplay = document.getElementById('outputTextDisplay'); // *** שינוי קריטי כאן! ***
const hiddenFixedText = document.getElementById('hiddenFixedText');
const summaryOutput = document.getElementById('summaryOutput');
const statusMessage = document.getElementById('statusMessage');

document.addEventListener('DOMContentLoaded', async () => {
    await loadDictionaries();
});

async function loadDictionaries() {
    showStatusMessage('טוען מילונים...', 'info');
    try {
        const [dictResponse, typosResponse] = await Promise.all([
            fetch(HEBREW_DICT_URL),
            fetch(COMMON_TYPOS_URL)
        ]);

        if (!dictResponse.ok) throw new Error(`HTTP error! status: ${dictResponse.status} from ${HEBREW_DICT_URL}`);
        if (!typosResponse.ok) throw new Error(`HTTP error! status: ${typosResponse.status} from ${COMMON_TYPOS_URL}`);

        const dictData = await dictResponse.json();
        const typosData = await typosResponse.json();

        hebrewDictionary = new Set(dictData);
        commonTypos = typosData;

        showStatusMessage('המילונים נטענו בהצלחה!', 'success');
        console.log("Hebrew Dictionary Loaded. Size:", hebrewDictionary.size);
        console.log("Common Typos Loaded. Keys:", Object.keys(commonTypos).length);

    } catch (error) {
        console.error("Failed to load dictionaries:", error);
        showStatusMessage(`שגיאה בטעינת המילונים: ${error.message}. אנא נסה שוב מאוחר יותר.`, 'error', 10000);
        fixButton.disabled = true;
    }
}

function showStatusMessage(message, type, duration = 3000) {
    statusMessage.textContent = message;
    statusMessage.className = `message show ${type}`;
    if (statusMessage.timeoutId) {
        clearTimeout(statusMessage.timeoutId);
    }
    statusMessage.timeoutId = setTimeout(() => {
        statusMessage.classList.remove('show');
    }, duration);
}

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = (a.charAt(j - 1) === b.charAt(i - 1)) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

function fixText(text) {
    let fixedText = text.replace(/([.,:;?!])(?!\s|$)/g, '$1 ').replace(/\s+([.,:;?!])/g, '$1');

    fixedText = fixedText.replace(/(\s|^)"(\S)/g, '$1" $2');
    fixedText = fixedText.replace(/(\S)"(\s|$)/g, '$1" $2');
    fixedText = fixedText.replace(/(\s|^)'(\S)/g, '$1\' $2');
    fixedText = fixedText.replace(/(\S)'(\s|$)/g, '$1\' $2');

    const words = fixedText.match(/[\p{L}\d'"-]+|[.,:;?!"]+\s*|\s+/gu) || [];
    let correctedWords = [];
    let changes = [];

    words.forEach(word => {
        if (word.trim() === '') {
            correctedWords.push(word);
            return;
        }

        const originalWord = word.replace(/[.,:;?!'"]/g, '').toLowerCase();
        const punctuationBefore = word.match(/^([.,:;?!'"]+)/)?.[1] || '';
        const punctuationAfter = word.match(/([.,:;?!'"]+)$/)?.[1] || '';
        const nonAlphaNumBefore = word.match(/^([^\p{L}\d]+)/u)?.[1] || '';
        const nonAlphaNumAfter = word.match(/([^\p{L}\d]+)$/u)?.[1] || '';

        if (commonTypos[originalWord]) {
            const corrected = commonTypos[originalWord];
            correctedWords.push(nonAlphaNumBefore + corrected + nonAlphaNumAfter);
            changes.push({
                type: 'typo',
                original: originalWord,
                corrected: corrected
            });
        }
        else if (hebrewDictionary.has(originalWord)) {
            correctedWords.push(word);
        }
        else {
            let bestMatch = originalWord;
            let minDistance = Infinity;
            const wordsToCheck = Array.from(hebrewDictionary);

            if (originalWord.length > 1) {
                for (const dictWord of wordsToCheck) {
                    const distance = levenshteinDistance(originalWord, dictWord);
                    if (distance < minDistance && distance <= 2) {
                        minDistance = distance;
                        bestMatch = dictWord;
                    }
                }
            }

            if (bestMatch !== originalWord && minDistance <= 2) {
                correctedWords.push(nonAlphaNumBefore + bestMatch + nonAlphaNumAfter);
                changes.push({
                    type: 'typo',
                    original: originalWord,
                    corrected: bestMatch
                });
            } else {
                correctedWords.push(word);
                if (originalWord.length > 0 && isNaN(originalWord)) {
                     changes.push({
                         type: 'unknown',
                         original: originalWord,
                         corrected: null
                     });
                }
            }
        }
    });

    const finalFixedText = correctedWords.join('');

    return {
        fixedText: finalFixedText,
        changes: changes
    };
}

function generateHighlightedOutput(originalText, fixedText) {
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(originalText, fixedText);
    dmp.diff_cleanupSemantic(diff);

    let outputHtml = '';
    const summaryList = [];

    diff.forEach(part => {
        const value = part[1];
        const type = part[0];

        if (type === 1) {
            outputHtml += `<span class="highlight-added">${value}</span>`;
            summaryList.push(`הוספה: "${value}"`);
        } else if (type === -1) {
            outputHtml += `<span class="highlight-removed">${value}</span>`;
            summaryList.push(`הסרה: "${value}"`);
        } else {
            outputHtml += value;
        }
    });

    return { html: outputHtml, summary: summaryList };
}


fixButton.addEventListener('click', () => {
    const originalInput = inputText.value;
    if (originalInput.trim() === '') {
        showStatusMessage('אנא הכנס טקסט לתיקון.', 'info');
        return;
    }

    showStatusMessage('מתקן טקסט...', 'info');

    const { fixedText, changes } = fixText(originalInput);

    // *** חשוב: שימוש ב-outputTextDisplay במקום outputText ***
    outputTextDisplay.innerHTML = '';
    hiddenFixedText.value = fixedText;

    const { html: highlightedHtml, summary: diffSummary } = generateHighlightedOutput(originalInput, fixedText);
    // *** חשוב: שימוש ב-outputTextDisplay במקום outputText ***
    outputTextDisplay.innerHTML = highlightedHtml;

    summaryOutput.innerHTML = '';
    const ul = document.createElement('ul');
    if (changes.length === 0 && diffSummary.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'לא זוהו תיקונים בטקסט.';
        ul.appendChild(li);
    } else {
        changes.forEach(change => {
            const li = document.createElement('li');
            if (change.type === 'typo') {
                li.textContent = `תוקן איות: ${change.original} -> ${change.corrected}`;
            } else if (change.type === 'unknown') {
                li.textContent = `אזהרה: המילה "${change.original}" לא נמצאה במילון.`;
            }
            ul.appendChild(li);
        });

        diffSummary.forEach(item => {
             const li = document.createElement('li');
             li.textContent = item;
             ul.appendChild(li);
        });
    }
    summaryOutput.appendChild(ul);

    showStatusMessage('הטקסט תוקן בהצלחה!', 'success');
});

copyButton.addEventListener('click', () => {
    if (hiddenFixedText.value.trim() === '') {
        showStatusMessage('אין טקסט להעתקה.', 'info');
        return;
    }
    navigator.clipboard.writeText(hiddenFixedText.value)
        .then(() => {
            showStatusMessage('הטקסט המתוקן הועתק בהצלחה!', 'success');
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            showStatusMessage('שגיאה בעת העתקת הטקסט.', 'error');
        });
});

downloadButton.addEventListener('click', () => {
    if (hiddenFixedText.value.trim() === '') {
        showStatusMessage('אין טקסט להורדה.', 'info');
        return;
    }
    const textToSave = hiddenFixedText.value;
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'corrected_text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showStatusMessage('הטקסט המתוקן הורד בהצלחה!', 'success');
});


clearButton.addEventListener('click', () => {
    inputText.value = '';
    outputTextDisplay.innerHTML = ''; // *** שינוי קריטי כאן! ***
    hiddenFixedText.value = '';
    summaryOutput.innerHTML = '<ul><li>אין תיקונים או שגיאות שזוהו עדיין.</li></ul>';
    showStatusMessage('שדות הטקסט נוקו.', 'info');
});