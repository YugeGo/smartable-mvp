const dataPasteArea = document.getElementById("data-paste-area");
const commandInput = document.getElementById("command-input");
const executeBtn = document.getElementById("execute-btn");
const resultDisplay = document.getElementById("result-display");

executeBtn.addEventListener("click", async () => {
    const userInputData = dataPasteArea.value;
    const userCommand = commandInput.value;

    executeBtn.disabled = true;
    const originalBtnText = executeBtn.textContent;
    executeBtn.textContent = "思考中...";

    resultDisplay.textContent = "AI正在处理，请稍候...";

    console.log("Data:", userInputData);
    console.log("Command:", userCommand);

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: userInputData, command: userCommand })
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const result = await response.json();
        resultDisplay.textContent = result.message;
    } catch (error) {
        console.error(error);
        resultDisplay.textContent = "处理时出现错误，请稍后再试。";
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = originalBtnText || "执行指令";
    }
});
