document.addEventListener("DOMContentLoaded", async function () {
    const API_BASE = location.protocol === "file:" || location.port !== "3000" ? "http://localhost:3000" : "";
    if (location.protocol === "file:" || location.port !== "3000") {
        location.replace("http://localhost:3000/user.html");
        return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = "/Login.html";
        return;
    }

    let currentUser;

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

    function redirectToLogin() {
        localStorage.removeItem("authToken");
        window.location.href = "/Login.html";
    }

    try {
        const data = await apiFetch("/api/me");
        currentUser = data.user;
    } catch (error) {
        redirectToLogin();
        return;
    }

    const userIcon = document.getElementById("userIcon");
    const dropdown = document.getElementById("profileDropdown");
    const startVoting = document.getElementById("startVoting");
    const votingForm = document.getElementById("votingForm");
    const voterInput = document.getElementById("voterId");
    const dobInput = document.getElementById("dob");
    const message = document.getElementById("message");
    const myVoteBtn = document.getElementById("myVoteBtn");
    const myVoteResult = document.getElementById("myVoteResult");
    const submitBtn = document.getElementById("submitVote");
    const resultsBtn = document.querySelector(".secondary-btn");

    document.getElementById("username").textContent = currentUser.fullname;
    const heroName = document.querySelector(".hero-username");
    if (heroName) heroName.textContent = currentUser.fullname;

    if (currentUser.photo) {
        userIcon.style.backgroundImage = `url("${currentUser.photo}")`;
        userIcon.textContent = "";
    } else {
        userIcon.textContent = currentUser.fullname.charAt(0).toUpperCase();
        userIcon.style.backgroundImage = "";
    }

    document.getElementById("pName").textContent = currentUser.fullname;
    document.getElementById("pPhone").textContent = currentUser.phone;
    document.getElementById("pAadhaar").textContent = currentUser.aadhaarMasked;
    document.getElementById("pVoterId").textContent = currentUser.voterId;
    document.getElementById("voterStatus").textContent = currentUser.voteCompleted ? "Vote completed" : "Ready to vote";

    userIcon.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.classList.toggle("show");
    });

    window.addEventListener("click", (event) => {
        if (!event.target.closest(".profile-section")) {
            dropdown.classList.remove("show");
        }
    });

    if (currentUser.voteCompleted) {
        startVoting.disabled = true;
        startVoting.textContent = "Voting Completed";
        startVoting.style.opacity = "0.6";
        startVoting.style.cursor = "not-allowed";
        myVoteResult.style.color = "green";
        myVoteResult.textContent = "You voted for: " + currentUser.selectedParty;
    }

    startVoting.addEventListener("click", () => {
        if (currentUser.voteCompleted) return;
        votingForm.style.display = "block";
    });

    submitBtn.addEventListener("click", async function () {
        if (currentUser.voteCompleted) return;

        const voterId = voterInput.value.trim().toUpperCase();
        const dob = dobInput.value;
        const voterIdPattern = /^[A-Za-z0-9]{10}$/;

        if (!voterIdPattern.test(voterId)) {
            message.style.color = "red";
            message.textContent = "Voter ID must be exactly 10 letters or numbers.";
            return;
        }

        if (!dob) {
            message.style.color = "red";
            message.textContent = "Please select Date of Birth.";
            return;
        }

        try {
            await apiFetch("/api/verify-voter", {
                method: "POST",
                body: JSON.stringify({ voterId, dob })
            });
            message.style.color = "green";
            message.textContent = "Verification successful. Redirecting...";
            setTimeout(function () {
                window.location.href = "/vote.html";
            }, 800);
        } catch (error) {
            message.style.color = "red";
            message.textContent = error.message;
        }
    });

    myVoteBtn.addEventListener("click", function (event) {
        event.preventDefault();

        if (currentUser.voteCompleted && currentUser.selectedParty) {
            myVoteResult.style.color = "green";
            myVoteResult.textContent = "You voted for: " + currentUser.selectedParty;
        } else {
            myVoteResult.style.color = "red";
            myVoteResult.textContent = "You have not voted yet.";
        }
    });

    if (resultsBtn) {
        resultsBtn.addEventListener("click", () => {
            window.location.href = "result.html";
        });
    }

    document.getElementById("logoutBtn").addEventListener("click", async function (event) {
        event.preventDefault();
        try {
            await apiFetch("/api/logout", { method: "POST", body: JSON.stringify({}) });
        } catch {
            // The local token still needs to be cleared even if the session expired.
        }
        redirectToLogin();
    });

    setupChat();
});

function setupChat() {
    const chatMenu = document.getElementById("chatMenu");
    const chatContainer = document.getElementById("chatContainer");
    const closeChat = document.getElementById("closeChat");
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("messageInput");
    const chatBox = document.getElementById("chatBox");
    const chatBadge = document.getElementById("chatBadge");
    const roleSelect = document.getElementById("roleSelect");

    if (!chatMenu || !chatContainer || !closeChat || !sendBtn || !messageInput || !chatBox) {
        return;
    }

    let unreadCount = 0;

    chatMenu.addEventListener("click", function () {
        chatContainer.style.display = "flex";
        unreadCount = 0;
        chatBadge.textContent = unreadCount;
    });

    closeChat.addEventListener("click", function () {
        chatContainer.style.display = "none";
    });

    sendBtn.addEventListener("click", sendMessage);

    messageInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text === "") return;

        const role = roleSelect && roleSelect.value === "admin" ? "admin" : "user";
        addMessage(text, role);
        messageInput.value = "";

        if (role === "user") {
            setTimeout(() => {
                botReply(text);
            }, 800);
        }
    }

    function addMessage(text, type) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        messageDiv.classList.add(type === "user" ? "user-message" : "admin-message");
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (chatContainer.style.display === "none" && type === "admin") {
            unreadCount++;
            chatBadge.textContent = unreadCount;
        }
    }

    function botReply(userMessage) {
        const msg = userMessage.toLowerCase();
        let reply = "Sorry, I did not understand that. Please contact support at click2web.2026@gmail.com.";

        if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
            reply = "Hey voter. How can I help you today?";
        } else if (msg.includes("vote")) {
            reply = "To vote, go to the dashboard and click Start Voting.";
        } else if (msg.includes("result")) {
            reply = "Results are available from the Results page.";
        } else if (msg.includes("login")) {
            reply = "Use your registered Aadhaar number, send the demo OTP, then login.";
        } else if (msg.includes("thanks")) {
            reply = "You are welcome.";
        }

        addMessage(reply, "admin");
    }
}
