 // קובץ script.js - כולל לוגיקת תיקון ודגשה מלאה
// המילונים מגיעים מקובץ dictionaries.js
// ודא ש dictionaries.js נטען לפני script.js ב-HTML

// אלמנטים מה-HTML
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const hiddenFixedText = document.getElementById('hiddenFixedText');
const fixButton = document.getElementById('fixButton');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton'); // התיקון כאן!
const clearButton = document.getElementById('clearButton');
const statusMessage = document.getElementById('statusMessage');
const summaryOutput = document.getElementById('summaryOutput');
const trialStatusMessage = document.getElementById('trialStatusMessage');

// הגבלת שימושים
let usesLeft = 10;
const MAX_USES = 10;

// פונקציה לשמירת נתונים ב-localStorage
function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Error saving to localStorage:", e);
    }
}

// פונקציה לטעינת נתונים מ-localStorage
function loadFromLocalStorage(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        console.error("Error loading from localStorage:", e);
        return null;
    }
}

// טעינת מספר השימושים שנותרו
document.addEventListener('DOMContentLoaded', () => {
    const savedUses = loadFromLocalStorage('usesLeft');
    if (savedUses !== null) {
        usesLeft = savedUses;
    }
    updateTrialStatus();
    console.log("script.js loaded successfully!");
});


// פונקציה לעדכון הודעת הניסיון
function updateTrialStatus() {
    if (usesLeft <= 0) {
        trialStatusMessage.textContent = 'נגמרו לך השימושים החינמיים. אנא שקול לשדרג.';
        fixButton.disabled = true;
    } else {
        trialStatusMessage.textContent = `נותרו לך ${usesLeft} שימושים חינמיים.`;
        fixButton.disabled = false;
    }
}

// פונקציה להצגת הודעות סטטוס
function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `message show ${type}`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

// פונקציה לחישוב מרחק לוינשטיין (Levenshtein Distance)
function levenshteinDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) {
            costs[s2.length] = lastValue;
        }
    }
    return costs[s2.length];
}

// פונקציה למציאת המילה הקרובה ביותר במילון
function findClosestWord(word, dictionary, maxDistance = 2) {
    let closestWord = null;
    let minDistance = Infinity;

    // הסרת פיסוק מהמילה לבדיקה
    const cleanWord = word.replace(/[^א-ת]/g, '');

    if (!cleanWord) return null; // אם המילה ריקה אחרי הסרת פיסוק

    for (const dictWord of dictionary) {
        // הסרת פיסוק מהמילה במילון
        const cleanDictWord = dictWord.replace(/[^א-ת]/g, '');
        if (!cleanDictWord) continue;

        const dist = levenshteinDistance(cleanWord, cleanDictWord);

        if (dist <= maxDistance && dist < minDistance) {
            minDistance = dist;
            closestWord = dictWord;
        }
    }
    return closestWord;
}

// פונקציה לתיקון פיסוק בלבד
function fixPunctuation(text) {
    let fixedText = text;

    // הסרת רווחים כפולים ורווחים מיותרים בהתחלה ובסוף
    fixedText = fixedText.replace(/\s+/g, ' ').trim();

    // הוספת רווח אחרי פיסוק אם אין (חוץ מגרשיים, מירכאות, וסוגריים)
    fixedText = fixedText.replace(/([.,?!:;])(?=\S)/g, '$1 ');
    fixedText = fixedText.replace(/(\S)\((?=\S)/g, '$1 ('); // הוסף רווח לפני סוגר פותח אם אין
    fixedText = fixedText.replace(/(?<=\S)\)(\S)/g, ') $1'); // הוסף רווח אחרי סוגר סוגר אם אין
    
    // הסרת רווחים לפני פיסוק (למעט סוגריים פותחים)
    fixedText = fixedText.replace(/\s+([.,?!:;])/g, '$1');
    fixedText = fixedText.replace(/\s+\)/g, ')');
    
    // טיפול במירכאות וגרשיים
    fixedText = fixedText.replace(/(\S)"/g, '$1"'); // הסר רווח לפני מירכאה פותחת
    fixedText = fixedText.replace(/"(\S)/g, '"$1'); // הסר רווח אחרי מירכאה פותחת
    fixedText = fixedText.replace(/(\S)"/g, '$1"'); // הסר רווח לפני מירכאה סוגרת
    fixedText = fixedText.replace(/"(\S)/g, '"$1'); // הסר רווח אחרי מירכאה סוגרת

    fixedText = fixedText.replace(/(\S)'/g, '$1\''); // הסר רווח לפני גרש
    fixedText = fixedText.replace(/'(\S)/g, '\'$1'); // הסר רווח אחרי גרש

    // טיפול בנקודות שלוש (אליפסיס)
    fixedText = fixedText.replace(/\s*\.{3}\s*/g, '...');

    // טיפול במקף
    fixedText = fixedText.replace(/(\S)-(\S)/g, '$1 - $2'); // הוסף רווחים סביב מקף בין מילים
    fixedText = fixedText.replace(/\s+-\s+/g, ' - '); // ודא שיש רווח בודד סביב מקפים
    
    // הסרת רווחים כפולים שוב בסוף התהליך
    fixedText = fixedText.replace(/\s+/g, ' ').trim();

    return fixedText;
}


// פונקציה לביצוע ההשוואה וההדגשה
function generateHighlightedOutput(originalText, fixedText, typosCorrections) {
    const originalWords = originalText.split(/(\s+|[.,?!:;'"()`\[\]{}<>#@$%^&*+\-_=\\/\/`])/).filter(word => word !== '');
    const fixedWords = fixedText.split(/(\s+|[.,?!:;'"()`\[\]{}<>#@$%^&*+\-_=\\/\/`])/).filter(word => word !== '');

    let outputHtml = '';
    let originalIndex = 0;
    let fixedIndex = 0;

    const punctuationFixes = [];
    const addedWords = [];
    const removedWords = [];
    const spellingFixes = [];

    while (originalIndex < originalWords.length || fixedIndex < fixedWords.length) {
        const originalSegment = originalWords[originalIndex] || '';
        const fixedSegment = fixedWords[fixedIndex] || '';

        // אם המילה המקורית נמצאת בתיקוני איות
        const typoFixed = typosCorrections[originalSegment];
        if (typoFixed && typoFixed === fixedSegment) {
            outputHtml += `<span class="highlight-typo" title="תוקן ל: ${typoFixed}">${originalSegment}</span> `;
            spellingFixes.push(`${originalSegment} -> ${typoFixed}`);
            originalIndex++;
            fixedIndex++;
            continue;
        }

        // אם מקטעים זהים, הוסף אותם כרגיל
        if (originalSegment === fixedSegment) {
            outputHtml += `${fixedSegment} `;
            originalIndex++;
            fixedIndex++;
        } else {
            // ניסיון לזהות שינויים בפיסוק או מילים שאינן תואמות ישירות
            let foundMatch = false;

            // חפש אם המקטע המקורי קיים קדימה בטקסט המתוקן
            for (let i = fixedIndex; i < fixedWords.length; i++) {
                if (originalSegment === fixedWords[i] && originalSegment.trim() !== '') { // וודא שהמקטע לא רווח ריק
                    // מצאנו התאמה, כל מה שביניהם נוסף
                    for (let j = fixedIndex; j < i; j++) {
                        outputHtml += `<span class="highlight-added">${fixedWords[j]}</span> `;
                        addedWords.push(fixedWords[j]);
                    }
                    outputHtml += `${originalSegment} `; // המקטע המקורי התאמה
                    fixedIndex = i + 1;
                    originalIndex++;
                    foundMatch = true;
                    break;
                }
            }
            
            if (!foundMatch) {
                // חפש אם המקטע המתוקן קיים קדימה בטקסט המקורי
                for (let i = originalIndex; i < originalWords.length; i++) {
                    if (fixedSegment === originalWords[i] && fixedSegment.trim() !== '') { // וודא שהמקטע לא רווח ריק
                        // מצאנו התאמה, כל מה שביניהם הוסר
                        for (let j = originalIndex; j < i; j++) {
                            outputHtml += `<span class="highlight-removed">${originalWords[j]}</span> `;
                            removedWords.push(originalWords[j]);
                        }
                        outputHtml += `${fixedSegment} `; // המקטע המתוקן התאמה
                        originalIndex = i + 1;
                        fixedIndex++;
                        foundMatch = true;
                        break;
                    }
                }
            }

            if (!foundMatch) {
                // אם עדיין לא נמצאה התאמה, זה שינוי או הוספה/הסרה בסוף
                if (originalSegment && !fixedSegment) { // מקטע הוסר
                    outputHtml += `<span class="highlight-removed">${originalSegment}</span> `;
                    removedWords.push(originalSegment);
                    originalIndex++;
                } else if (!originalSegment && fixedSegment) { // מקטע נוסף
                    outputHtml += `<span class="highlight-added">${fixedSegment}</span> `;
                    addedWords.push(fixedSegment);
                    fixedIndex++;
                } else { // החלפת מקטע או שינוי פיסוק/איות
                    // בדיקה אם זה רק שינוי פיסוק סביב מילה
                    const cleanOriginal = originalSegment.replace(/[^א-ת]/g, '');
                    const cleanFixed = fixedSegment.replace(/[^א-ת]/g, '');
                    
                    if (cleanOriginal === cleanFixed && originalSegment !== fixedSegment && cleanOriginal.length > 0) {
                        // זה כנראה שינוי פיסוק
                        outputHtml += `<span class="highlight-added" title="תוקן פיסוק">${fixedSegment}</span> `;
                        punctuationFixes.push(`${originalSegment} -> ${fixedSegment}`);
                    } else if (originalSegment.trim() !== '' || fixedSegment.trim() !== '') {
                        // החלפה כללית של מקטע (לאו דווקא איות)
                        outputHtml += `<span class="highlight-removed">${originalSegment}</span> <span class="highlight-added">${fixedSegment}</span> `;
                        removedWords.push(originalSegment);
                        addedWords.push(fixedSegment);
                    }
                    originalIndex++;
                    fixedIndex++;
                }
            }
        }
    }

    let summaryHtml = '<ul>';
    if (punctuationFixes.length > 0) {
        summaryHtml += `<li><strong>תיקוני פיסוק (${punctuationFixes.length}):</strong> ${punctuationFixes.join(', ')}.</li>`;
    }
    if (spellingFixes.length > 0) {
        summaryHtml += `<li><strong>תיקוני איות (${spellingFixes.length}):</strong> ${spellingFixes.join(', ')}.</li>`;
    }
    if (addedWords.length > 0) {
        summaryHtml += `<li><strong>מילים/מקטעים שנוספו (${addedWords.length}):</strong> ${addedWords.join(', ')}.</li>`;
    }
    if (removedWords.length > 0) {
        summaryHtml += `<li><strong>מילים/מקטעים שהוסרו (${removedWords.length}):</strong> ${removedWords.join(', ')}.</li>`;
    }
    if (punctuationFixes.length === 0 && spellingFixes.length === 0 && addedWords.length === 0 && removedWords.length === 0) {
        summaryHtml += '<li>לא זוהו תיקונים או שגיאות. הטקסט תקין.</li>';
    }
    summaryHtml += '</ul>';

    summaryOutput.innerHTML = summaryHtml;
    return outputHtml.trim();
}


// פונקציה ראשית לטיפול בטקסט
fixButton.addEventListener('click', () => {
    // ודא שהמילונים נטענו
    if (typeof hebrewDictionary === 'undefined' || typeof commonTypos === 'undefined') {
        showStatusMessage('המילונים עדיין לא נטענו. אנא רענן את העמוד.', 'error');
        console.error("Dictionaries not loaded!");
        return;
    }

    if (usesLeft <= 0) {
        showStatusMessage('נגמרו לך השימושים החינמיים. אנא שקול לשדרג.', 'error');
        return;
    }

    let originalText = inputText.value;
    if (!originalText.trim()) {
        showStatusMessage('אנא הכנס טקסט לבדיקה.', 'error');
        return;
    }

    let fixedText = originalText;
    const currentTyposCorrections = {};
    const words = fixedText.split(/\s+/); // פיצול לפי רווחים

    let tempFixedWords = [];

    // 1. תיקון שגיאות כתיב נפוצות (commonTypos)
    for (const word of words) {
        const cleanWord = word.replace(/[^א-ת]/g, ''); // הסר פיסוק מהמילה
        if (commonTypos[cleanWord]) {
            const correctedWord = commonTypos[cleanWord];
            // שמור תיקון ב-currentTyposCorrections כדי שנוכל להדגיש מאוחר יותר
            currentTyposCorrections[word] = correctedWord; 
            tempFixedWords.push(word.replace(cleanWord, correctedWord)); // החלף רק את חלק המילה, השאר פיסוק מקורי
        } else {
            tempFixedWords.push(word);
        }
    }
    fixedText = tempFixedWords.join(' ');


    // 2. תיקון פיסוק
    fixedText = fixPunctuation(fixedText);


    // 3. בדיקת איות מול המילון (hebrewDictionary) - אם לא תוקן כבר ב-commonTypos
    const finalWordsForSpellCheck = fixedText.split(/\s+/); // פיצול מחדש לאחר תיקון פיסוק
    let finalFixedTextArray = [];

    for (const word of finalWordsForSpellCheck) {
        const cleanWord = word.replace(/[^א-ת]/g, ''); // הסר פיסוק מהמילה לבדיקה
        if (cleanWord && !hebrewDictionary.has(cleanWord) && !currentTyposCorrections[word]) { // אם לא תוקן כבר ואין במילון
            const closest = findClosestWord(cleanWord, hebrewDictionary);
            if (closest) {
                // החלף רק את החלק של האותיות במילה, השאר את הפיסוק המקורי
                const correctedWordWithPunctuation = word.replace(cleanWord, closest);
                finalFixedTextArray.push(correctedWordWithPunctuation);
                currentTyposCorrections[word] = correctedWordWithPunctuation; // הוסף לתיקונים כדי שיודגש
            } else {
                finalFixedTextArray.push(word); // השאר כפי שהיה
            }
        } else {
            finalFixedTextArray.push(word);
        }
    }
    const finalFixedText = finalFixedTextArray.join(' ');


    // הצגת הטקסט המתוקן עם הדגשות
    const highlightedHtml = generateHighlightedOutput(originalText, finalFixedText, currentTyposCorrections);
    outputText.innerHTML = highlightedHtml;
    hiddenFixedText.value = finalFixedText; // שמירה עבור העתקה/הורדה

    usesLeft--;
    saveToLocalStorage('usesLeft', usesLeft);
    updateTrialStatus();
    showStatusMessage('הטקסט תוקן ונבדק בהצלחה!', 'success');
});

// פונקציה להעתקת הטקסט המתוקן
copyButton.addEventListener('click', () => {
    if (!hiddenFixedText.value) {
        showStatusMessage('אין טקסט להעתקה.', 'error');
        return;
    }
    navigator.clipboard.writeText(hiddenFixedText.value).then(() => {
        showStatusMessage('הטקסט הועתק בהצלחה!', 'success');
    }).catch(err => {
        showStatusMessage('שגיאה בהעתקת הטקסט.', 'error');
        console.error('Could not copy text: ', err);
    });
});

// פונקציה להורדת הטקסט המתוקן
downloadButton.addEventListener('click', () => {
    if (!hiddenFixedText.value) {
        showStatusMessage('אין טקסט להורדה.', 'error');
        return;
    }
    const filename = 'טקסט-מתוקן.txt';
    const blob = new Blob([hiddenFixedText.value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showStatusMessage('הטקסט הורד בהצלחה!', 'success');
});

// פונקציה לניקוי שדות הטקסט
clearButton.addEventListener('click', () => {
    inputText.value = '';
    outputText.innerHTML = '';
    hiddenFixedText.value = '';
    summaryOutput.innerHTML = '<ul><li>אין תיקונים או שגיאות שזוהו עדיין.</li></ul>';
    showStatusMessage('השדות נוקו.', 'info');
});