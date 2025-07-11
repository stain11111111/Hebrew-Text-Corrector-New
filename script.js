// ... (בתוך fixButton.addEventListener)

fixButton.addEventListener('click', () => {
    const originalInput = inputText.value;
    if (originalInput.trim() === '') {
        showStatusMessage('אנא הכנס טקסט לתיקון.', 'info');
        return;
    }

    showStatusMessage('מתקן טקסט...', 'info');

    const { fixedText, changes } = fixText(originalInput); // השתמש במערך השינויים מ-fixText

    outputText.innerHTML = '';
    hiddenFixedText.value = fixedText;

    // השתמש ב-diff_match_patch רק לצורך הדגשה ויזואלית, לא לצורך סיכום הטקסטואלי
    const dmp = new diff_match_patch();
    const diff = dmp.diff_main(originalInput, fixedText);
    dmp.diff_cleanupSemantic(diff);

    let outputHtml = '';
    diff.forEach(part => {
        const value = part[1];
        const type = part[0];

        if (type === 1) { // Added
            outputHtml += `<span class="highlight-added">${value}</span>`;
        } else if (type === -1) { // Removed
            outputHtml += `<span class="highlight-removed">${value}</span>`;
        } else { // Equal
            outputHtml += value;
        }
    });
    outputText.innerHTML = outputHtml; // הצג את הטקסט המודגש

    // הצג סיכום תיקונים *רק* מתוך מערך ה-changes שלנו
    summaryOutput.innerHTML = '';
    const ul = document.createElement('ul');
    if (changes.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'לא זוהו תיקונים בטקסט.';
        ul.appendChild(li);
    } else {
        changes.forEach(change => {
            const li = document.createElement('li');
            if (change.type === 'typo') {
                li.textContent = `תוקן איות: "${change.original}" -> "${change.corrected}"`;
            } else if (change.type === 'unknown') {
                li.textContent = `אזהרה: המילה "${change.original}" לא נמצאה במילון הראשי.`;
            }
            ul.appendChild(li);
        });
    }
    summaryOutput.appendChild(ul);

    showStatusMessage('הטקסט תוקן בהצלחה!', 'success');
});

// הסר את פונקציית generateHighlightedOutput - הטמענו את הלוגיקה שלה ישירות
// או שנה אותה כך שתחזיר רק HTML ללא סיכום טקסטואלי.
// כרגע השארתי אותה והעברתי את הלוגיקה שלה. עדיף להסיר אותה לחלוטין.