export default function handler(request, response) {
    response.status(200);
    response.setHeader("Content-Type", "application/json");
    response.send({ message: "Hello from the backend! Your request was received." });
}
