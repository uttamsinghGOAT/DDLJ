const wrongOrigin = location.protocol === "file:" || location.port !== "3000";

if (wrongOrigin) {
    location.replace("http://localhost:3000/vote.html");
} else {
    const token = localStorage.getItem("authToken");
    const API_BASE = "";

    if (!token) {
        window.location.href = "/Login.html";
    }

    const cards = document.querySelectorAll(".candidate-card");
    const confirmBtn = document.getElementById("confirmVote");
    const message = document.getElementById("voteMessage");
    let selectedParty = null;
    let currentUser = null;

    async function apiFetch(path, options = {}) {
        const response = await fetch(API_BASE + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }
        return data;
    }

    function showMessage(text, color) {
        message.style.color = color;
        message.textContent = text;
    }

    async function loadUser() {
        try {
            const data = await apiFetch("/api/me");
            currentUser = data.user;
            if (currentUser.voteCompleted) {
                alert("You have already cast your vote.");
                window.location.href = "/user.html";
            }
        } catch (error) {
            localStorage.removeItem("authToken");
            window.location.href = "/Login.html";
        }
    }

    cards.forEach(card => {
        card.addEventListener("click", () => {
            cards.forEach(item => item.classList.remove("selected"));
            card.classList.add("selected");
            card.querySelector("input").checked = true;
            selectedParty = card.getAttribute("data-party");
        });
    });

    confirmBtn.addEventListener("click", async () => {
        if (!selectedParty) {
            showMessage("Please select a party before confirming.", "red");
            return;
        }

        confirmBtn.disabled = true;
        showMessage("Submitting your vote...", "#1f3b73");

        try {
            await apiFetch("/api/vote", {
                method: "POST",
                body: JSON.stringify({ party: selectedParty })
            });

            showMessage("Vote successfully submitted!", "green");
            setTimeout(() => {
                window.location.href = "/user.html";
            }, 1200);
        } catch (error) {
            confirmBtn.disabled = false;
            showMessage(error.message, "red");
        }
    });

    loadUser();
}
