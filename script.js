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
const outputTextDisplay = document.getElementById('outputTextDisplay'); // *** תיקון כאן: שינוי ל-outputTextDisplay ***
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

// *** פונקציה חדשה לטיפול בכללי פיסוק ***
function applyPunctuationRules(text) {
    let currentText = text;

    // 1. ניקוי רווחים כללי ונירמול
    currentText = currentText.replace(/\s+/g, ' '); // רווחים מרובים הופכים לרווח בודד
    currentText = currentText.replace(/\s*([.,:;?!"])\s*/g, '$1 '); // רווח אחרי פיסוק, אין רווח לפני
    currentText = currentText.replace(/([.,:;?!"])\s*$/, '$1'); // אם הפיסוק בסוף שורה, אל תוסיף רווח מיותר
    currentText = currentText.replace(/\(\s*/g, '(').replace(/\s*\)/g, ')'); // רווחים בתוך סוגריים

    // 2. כללים ספציפיים (כרגע בסיסיים מאוד - נרחיב בהמשך!)
    // פסיק לפני "ש" - גרסה בסיסית ומוגבלת (דורש שיפור בהמשך)
    // הערה: כלל זה יכול לייצר false positives, נדייק אותו בהמשך לפי הדוגמאות שלך.
    currentText = currentText.replace(/(\S)(?<![.,:;?!"])\sש(\S)/g, '$1, ש$2'); // למנוע פסיק אם יש כבר סימן פיסוק

    // טיפול בגרשיים (אגריש = ') - לוודא שאין רווחים פנימיים
    currentText = currentText.replace(/'\s*(\S)/g, '\'$1'); // אם יש ' ואז רווח ואז תו - להוריד רווח
    currentText = currentText.replace(/(\S)\s*'/g, '$1\''); // אם יש תו ואז רווח ואז ' - להוריד רווח

    // טיפול במרכאות (גרשיים כפולים = ") - לוודא שאין רווחים פנימיים
    currentText = currentText.replace(/"\s*(\S)/g, '"$1');
    currentText = currentText.replace(/(\S)\s*"/g, '$1"');


    // כללים נוספים שיבואו כאן
    // ...

    return currentText;
}


function fixText(text) {
    // שלב 1: תיקון פיסוק כללי ונירמול רווחים
    let currentText = applyPunctuationRules(text);
    let changes = []; // רשימת השינויים שתאסוף גם תיקוני כתיב

    // שלב 2: פיצול מילים וטיפול בשגיאות כתיב (מבוסס מילון ולוינשטיין)
    // השתמש ב-currentText לאחר תיקוני הפיסוק
    const words = currentText.match(/[\p{L}\d'"-]+|[.,:;?!"]+\s*|\s+/gu) || [];
    let correctedWords = [];

    words.forEach(word => {
        if (word.trim() === '') {
            correctedWords.push(word);
            return;
        }

        const originalWord = word.replace(/[.,:;?!'"]/g, '').toLowerCase(); // מילה ללא פיסוק, בlowercase
        const nonAlphaNumBefore = word.match(/^([^\p{L}\d]+)/u)?.[1] || ''; // לכידת תווים שאינם אותיות/מספרים לפני המילה
        const nonAlphaNumAfter = word.match(/([^\p{L}\d]+)$/u)?.[1] || ''; // לכידת תווים שאינם אותיות/מספרים אחרי המילה

        if (commonTypos[originalWord]) {
            // תיקון שגיאות נפוצות ידועות
            const corrected = commonTypos[originalWord];
            correctedWords.push(nonAlphaNumBefore + corrected + nonAlphaNumAfter);
            changes.push({
                type: 'typo',
                original: originalWord,
                corrected: corrected
            });
        } else if (hebrewDictionary.has(originalWord)) {
            // מילה קיימת במילון - לא צריך לתקן
            correctedWords.push(word);
        } else {
            // מילה לא קיימת במילון ולא שגיאה נפוצה - נסה מרחק לוינשטיין
            let bestMatch = originalWord;
            let minDistance = Infinity;
            const wordsToCheck = Array.from(hebrewDictionary); // המרת ה-Set למערך לביצוע לולאה

            if (originalWord.length > 1) { // רק אם המילה מספיק ארוכה כדי להיות טעות הקלדה סבירה
                for (const dictWord of wordsToCheck) {
                    const distance = levenshteinDistance(originalWord, dictWord);
                    if (distance < minDistance && distance <= 1) { // *** השינוי המרכזי כאן: סף 1 ***
                        minDistance = distance;
                        bestMatch = dictWord;
                    }
                }
            }

            if (bestMatch !== originalWord && minDistance <= 1) { // ודא שהתגלה תיקון טוב
                correctedWords.push(nonAlphaNumBefore + bestMatch + nonAlphaNumAfter);
                changes.push({
                    type: 'typo',
                    original: originalWord,
                    corrected: bestMatch
                });
            } else {
                // לא נמצא תיקון אוטומטי סביר, השאר את המילה כפי שהיא וסמן כאזהרה
                correctedWords.push(word);
                if (originalWord.length > 0 && isNaN(originalWord)) { // אל תסמן מספרים כ"לא ידועים"
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
        const type = part[0]; // -1 = removed, 0 = common, 1 = added

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

    // *** תיקון שגוי: outputTextDisplay אמור להיות outputText לפי ה-HTML ***
    // זה תוקן בתחילת הקובץ, אז כאן זה בסדר
    // הערה: שורת הקוד למטה נראית תקינה כעת, כי outputTextDisplay מוגדר עם ה-ID הנכון למעלה.
    outputTextDisplay.innerHTML = ''; // מנקה את התצוגה לפני הכנסת טקסט חדש
    hiddenFixedText.value = fixedText;

    const { html: highlightedHtml, summary: diffSummary } = generateHighlightedOutput(originalInput, fixedText);
    outputTextDisplay.innerHTML = highlightedHtml; // מציג את הטקסט המתוקן עם הדגשות

    summaryOutput.innerHTML = '';
    const ul = document.createElement('ul');
    if (changes.length === 0 && diffSummary.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'לא זוהו תיקונים בטקסט.';
        ul.appendChild(li);
    } else {
        // הוספת סיכום שינויי כתיב/לא ידועים מה-fixText
        changes.forEach(change => {
            const li = document.createElement('li');
            if (change.type === 'typo') {
                li.textContent = `תוקן איות: "${change.original}" -> "${change.corrected}"`;
            } else if (change.type === 'unknown') {
                li.textContent = `אזהרה: המילה "${change.original}" לא נמצאה במילון.`;
            }
            ul.appendChild(li);
        });

        // הוספת סיכום שינויי הפיסוק מה-diff_match_patch (הוספות/הסרות תווים)
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
    outputTextDisplay.innerHTML = '';
    hiddenFixedText.value = '';
    summaryOutput.innerHTML = '<ul><li>אין תיקונים או שגיאות שזוהו עדיין.</li></ul>';
    showStatusMessage('שדות הטקסט נוקו.', 'info');
});