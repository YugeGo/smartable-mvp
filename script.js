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
        const mockResponse = "这是一个从AI返回的模拟结果。";
        await new Promise((resolve) => setTimeout(resolve, 1500));
        resultDisplay.textContent = mockResponse;
    } catch (error) {
        console.error(error);
        resultDisplay.textContent = "处理时出现错误，请稍后再试。";
    } finally {
        executeBtn.disabled = false;
        executeBtn.textContent = originalBtnText || "执行指令";
    }
});
