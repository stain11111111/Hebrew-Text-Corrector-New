// URLs לקבצי המילון ב-GitHub
const HEBREW_DICT_URL = 'https://raw.githubusercontent.com/stain11111111/hebrew-dictionaries/main/hebrewDictionary.json';
const COMMON_TYPOS_URL = 'https://raw.githubusercontent.com/stain11111111/hebrew-dictionaries/main/commonTypos.json';

let hebrewDictionary = new Set();
let commonTypos = {};

// אלמנטים מה-DOM
const inputText = document.getElementById('inputText');
const fixButton = document.getElementById('fixButton');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');
const outputText = document.getElementById('outputText');
const hiddenFixedText = document.getElementById('hiddenFixedText');
const summaryOutput = document.getElementById('summaryOutput');
const statusMessage = document.getElementById('statusMessage');

document.addEventListener('DOMContentLoaded', async () => {
    // טעינת מילונים
    await loadDictionaries();
    
    // בדיקת סטטוס שימושים (הוסר - נשאר כאן להערה בלבד)
    // updateTrialStatus(); 
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
        fixButton.disabled = true; // נטרל את הכפתור אם המילונים לא נטענו
    }
}

function showStatusMessage(message, type, duration = 3000) {
    statusMessage.textContent = message;
    statusMessage.className = `message show ${type}`; // Apply classes for styling and showing
    if (statusMessage.timeoutId) {
        clearTimeout(statusMessage.timeoutId);
    }
    statusMessage.timeoutId = setTimeout(() => {
        statusMessage.classList.remove('show');
    }, duration);
}

// פונקציית מרחק לוינשטיין (Levenshtein Distance)
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = (a.charAt(j - 1) === b.charAt(i - 1)) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

// פונקציה לתיקון איות ופיסוק
function fixText(text) {
    // שלב 1: תיקון פיסוק - טיפול ברווחים לפני/אחרי סימני פיסוק
    // מוודא שיש רווח אחרי פסיק, נקודה, נקודתיים, נקודה פסיק, סימן שאלה, סימן קריאה, ומונע רווח לפניהם.
    let fixedText = text.replace(/([.,:;?!])(?!\s|$)/g, '$1 ').replace(/\s+([.,:;?!])/g, '$1');
    
    // מירכאות וגרשיים
    fixedText = fixedText.replace(/(\s|^)"(\S)/g, '$1" $2'); // רווח אחרי מירכאה פותחת
    fixedText = fixedText.replace(/(\S)"(\s|$)/g, '$1" $2'); // רווח לפני מירכאה סוגרת
    fixedText = fixedText.replace(/(\s|^)'(\S)/g, '$1\' $2'); // רווח אחרי גרש פותח
    fixedText = fixedText.replace(/(\S)'(\s|$)/g, '$1\' $2'); // רווח לפני גרש סוגר


    // שלב 2: תיקון איות
    // השתמש בביטוי רגולרי לזיהוי מילים, כולל מילים עם גרשיים ומקפים
    const words = fixedText.match(/[\p{L}\d'"-]+|[.,:;?!"]+\s*|\s+/gu) || []; // תמיכה מלאה בעברית ובמספרים
    let correctedWords = [];
    let changes = []; // מערך לאחסון השינויים

    words.forEach(word => {
        // התעלם מרווחים כ"מילים" לתיקון איות
        if (word.trim() === '') {
            correctedWords.push(word);
            return;
        }

        const originalWord = word.replace(/[.,:;?!'"]/g, '').toLowerCase(); // נקה פיסוק לבדיקה
        const punctuationBefore = word.match(/^([.,:;?!'"]+)/)?.[1] || '';
        const punctuationAfter = word.match(/([.,:;?!'"]+)$/)?.[1] || '';
        const nonAlphaNumBefore = word.match(/^([^\p{L}\d]+)/u)?.[1] || ''; // תווים לא אלפאנומריים לפני
        const nonAlphaNumAfter = word.match(/([^\p{L}\d]+)$/u)?.[1] || ''; // תווים לא אלפאנומריים אחרי


        // בדיקה במילון הטעויות הנפוצות קודם
        if (commonTypos[originalWord]) {
            const corrected = commonTypos[originalWord];
            correctedWords.push(nonAlphaNumBefore + corrected + nonAlphaNumAfter);
            changes.push({
                type: 'typo',
                original: originalWord,
                corrected: corrected
            });
        }
        // בדיקה במילון העברי הראשי - אם המילה קיימת, היא נכונה ולא צריך לתקן אותה
        else if (hebrewDictionary.has(originalWord)) {
            correctedWords.push(word); // השאר את המילה המקורית עם הפיסוק שלה
        }
        // ניסיון למצוא תיקון קרוב (Levenshtein) רק אם המילה לא נמצאת במילון הראשי
        else {
            let bestMatch = originalWord;
            let minDistance = Infinity; // לדוגמה: 2
            const wordsToCheck = Array.from(hebrewDictionary); // המילון כרשימה

            // בדיקת דמיון רק למילים לא קצרות מדי (למנוע תיקונים שגויים של אותיות/מילים קצרות)
            if (originalWord.length > 1) { 
                for (const dictWord of wordsToCheck) {
                    const distance = levenshteinDistance(originalWord, dictWord);
                    if (distance < minDistance && distance <= 2) { // ניתן לשנות את הסף
                        minDistance = distance;
                        bestMatch = dictWord;
                    }
                }
            } // <--- זה הסוגר המסולסל שחסר היה כאן!
            
            // אם נמצא תיקון רלוונטי
            if (bestMatch !== originalWord && minDistance <= 2) {
                correctedWords.push(nonAlphaNumBefore + bestMatch + nonAlphaNumAfter);
                changes.push({
                    type: 'typo',
                    original: originalWord,
                    corrected: bestMatch
                });
            } else {
                // אם לא נמצא תיקון, השאר את המילה המקורית אבל סמן כשגיאה פוטנציאלית
                correctedWords.push(word);
                if (originalWord.length > 0 && isNaN(originalWord)) { // אל תסמן מספרים כשגיאות
                     changes.push({
                         type: 'unknown',
                         original: originalWord,
                         corrected: null
                     });
                }
                
            }
        }
    });

    // הרכבת הטקסט המתוקן מחדש
    const finalFixedText = correctedWords.join(''); // חיבור מחדש
    
    return {
        fixedText: finalFixedText,
        changes: changes
    };
}

// פונקציה להדגשת השינויים
function generateHighlightedOutput(originalText, fixedText) {
    // השתמש ב-diff_match_patch (Diff) כפי שהוגדר גלובלית
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(originalText, fixedText);
    dmp.diff_cleanupSemantic(diff); // אופציונלי: לשיפור קריאות ההבדלים

    let outputHtml = '';
    const summaryList = []; // ליצירת סיכום התיקונים

    diff.forEach(part => {
        const value = part[1]; // חלק[1] מכיל את הטקסט
        const type = part[0];  // חלק[0] מכיל את סוג השינוי (0=שווה, 1=הוספה, -1=הסרה)

        if (type === 1) { // Added
            outputHtml += `<span class="highlight-added">${value}</span>`;
            summaryList.push(`הוספה: "${value}"`);
        } else if (type === -1) { // Removed
            outputHtml += `<span class="highlight-removed">${value}</span>`;
            summaryList.push(`הסרה: "${value}"`);
        } else { // Equal
            outputHtml += value;
        }
    });

    return { html: outputHtml, summary: summaryList };
}


// כפתור "תקן טקסט"
fixButton.addEventListener('click', () => {
    const originalInput = inputText.value;
    if (originalInput.trim() === '') {
        showStatusMessage('אנא הכנס טקסט לתיקון.', 'info');
        return;
    }

    showStatusMessage('מתקן טקסט...', 'info');
    
    // בצע את התיקון בפועל
    const { fixedText, changes } = fixText(originalInput);
    
    // הצג את הטקסט המתוקן בתיבת הפלט
    outputText.innerHTML = ''; // נקה תוכן קודם
    // העבר את הטקסט המתוקן לשדה הנסתר לצורך העתקה/הורדה
    hiddenFixedText.value = fixedText; 

    // בנה את התצוגה המודגשת ואת סיכום השינויים
    const { html: highlightedHtml, summary: diffSummary } = generateHighlightedOutput(originalInput, fixedText);
    outputText.innerHTML = highlightedHtml;

    // הצג סיכום תיקונים
    summaryOutput.innerHTML = '';
    const ul = document.createElement('ul');
    if (changes.length === 0 && diffSummary.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'לא זוהו תיקונים בטקסט.';
        ul.appendChild(li);
    } else {
        // הוסף תיקוני איות מהלוגיקה של fixText
        changes.forEach(change => {
            const li = document.createElement('li');
            if (change.type === 'typo') {
                li.textContent = `תוקן איות: ${change.original} -> ${change.corrected}`;
            } else if (change.type === 'unknown') {
                li.textContent = `אזהרה: המילה "${change.original}" לא נמצאה במילון.`;
            }
            ul.appendChild(li);
        });

        // הוסף סיכום שינויים מהשוואת הטקסטים
        diffSummary.forEach(item => {
             const li = document.createElement('li');
             li.textContent = item;
             ul.appendChild(li);
        });
    }
    summaryOutput.appendChild(ul);
    
    showStatusMessage('הטקסט תוקן בהצלחה!', 'success');
});

// כפתור "העתק טקסט מתוקן"
copyButton.addEventListener('click', () => {
    if (hiddenFixedText.value.trim() === '') {
        showStatusMessage('אין טקסט להעתקה.', 'info');
        return;
    }
    hiddenFixedText.select();
    hiddenFixedText.setSelectionRange(0, 99999); // For mobile devices
    document.execCommand("copy");
    showStatusMessage('הטקסט המתוקן הועתק!', 'success');
});

// כפתור "הורד טקסט מתוקן"
downloadButton.addEventListener('click', () => {
    if (hiddenFixedText.value.trim() === '') {
        showStatusMessage('אין טקסט להורדה.', 'info');
        return;
    }
    const filename = "טקסט_מתוקן.txt";
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(hiddenFixedText.value));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showStatusMessage('הטקסט המתוקן יורד לקובץ.', 'success');
});

// כפתור "נקה"
clearButton.addEventListener('click', () => {
    inputText.value = '';
    outputText.innerHTML = '';
    hiddenFixedText.value = '';
    summaryOutput.innerHTML = '<ul><li>אין תיקונים או שגיאות שזוהו עדיין.</li></ul>';
    showStatusMessage('שדות הטקסט נוקו.', 'info');
});
