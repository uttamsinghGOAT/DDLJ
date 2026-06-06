document.addEventListener("DOMContentLoaded", function () {

    // GET USER
    let user = JSON.parse(localStorage.getItem("currentUser"));
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // SET PROFILE
    document.getElementById("username").innerText = user.fullname;
    const heroName = document.querySelector(".hero-username");
    if (heroName) heroName.innerText = user.fullname;
    const userIcon = document.getElementById("userIcon");
    if (user.photo) {
        userIcon.style.backgroundImage = `url(${user.photo})`;
        userIcon.innerText = '';
    } else {
        userIcon.innerText = user.fullname;
        userIcon.style.backgroundImage = '';
    }
    document.getElementById("pName").innerText = user.fullname;
    document.getElementById("pPhone").innerText = user.phone;
    document.getElementById("pAadhaar").innerText = user.aadhaar;
    document.getElementById("voterStatus").innerText = user.voteCompleted ? "Vote completed" : "Ready to vote";

    // PROFILE DROPDOWN
    const userIcon = document.getElementById("userIcon");
    const dropdown = document.getElementById("profileDropdown");

    userIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
    });

    window.addEventListener("click", (e) => {
        if (!e.target.closest(".profile-section")) {
            dropdown.classList.remove("show");
        }
    });

    // ELEMENTS
    const startVoting = document.getElementById("startVoting");
    const votingForm = document.getElementById("votingForm");
    const voterInput = document.getElementById("voterId");
    const dobInput = document.getElementById("dob");
    const message = document.getElementById("message");
    const myVoteBtn = document.getElementById("myVoteBtn");
    const myVoteResult = document.getElementById("myVoteResult");
    const submitBtn = document.getElementById("submitVote");

    // IF ALREADY VOTED
    if (user.voteCompleted) {
        startVoting.disabled = true;
        startVoting.innerText = "Voting Completed ✅";
        startVoting.style.opacity = "0.6";
        startVoting.style.cursor = "not-allowed";
    }

    // SHOW FORM
    startVoting.addEventListener("click", () => {
        if (user.voteCompleted) return;
        votingForm.style.display = "block";
    });

    // SUBMIT VERIFICATION
    submitBtn.addEventListener("click", function () {

        if (user.voteCompleted) return;

        const voterId = voterInput.value.trim();
        const dob = dobInput.value;

        // ✅ Must be exactly 10 letters/numbers
        const voterIdPattern = /^[A-Za-z0-9]{10}$/;

        if (!voterIdPattern.test(voterId)) {
            message.style.color = "red";
            message.innerText = "Voter ID must be exactly 10 letters or numbers.";
            return;
        }

        if (!dob) {
            message.style.color = "red";
            message.innerText = "Please select Date of Birth.";
            return;
        }

        // SUCCESS
        message.style.color = "green";
        message.innerText = "Verification Successful! Redirecting...";

        setTimeout(function () {
            window.location.href = "vote.html";
        }, 800);
    });

    // MY VOTE
    myVoteBtn.addEventListener("click", function () {

        if (user.voteCompleted && user.selectedParty) {
            myVoteResult.style.color = "green";
            myVoteResult.innerText = "You voted for: " + user.selectedParty;
        } else {
            myVoteResult.style.color = "red";
            myVoteResult.innerText = "You have not voted yet.";
        }

    });

    // LOGOUT
    document.getElementById("logoutBtn").addEventListener("click", function (e) {
        e.preventDefault();
        localStorage.removeItem("currentUser");
        window.location.href = "index.html";
    });

});
document.addEventListener("DOMContentLoaded", function () {

    const chatMenu = document.getElementById("chatMenu");
    const chatContainer = document.getElementById("chatContainer");
    const closeChat = document.getElementById("closeChat");
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("messageInput");
    const chatBox = document.getElementById("chatBox");
    const chatBadge = document.getElementById("chatBadge");

    let unreadCount = 0;

    // OPEN CHAT
    chatMenu.addEventListener("click", function () {
        chatContainer.style.display = "flex";
        unreadCount = 0;
        chatBadge.textContent = unreadCount;
    });

    // CLOSE CHAT
    closeChat.addEventListener("click", function () {
        chatContainer.style.display = "none";
    });

    sendBtn.addEventListener("click", sendMessage);

    messageInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message === "") return;

        addMessage(message, "user");
        messageInput.value = "";

        setTimeout(() => {
            botReply(message);
        }, 800);
    }

    function addMessage(text, type) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");

        if (type === "user") {
            messageDiv.classList.add("user-message");
        } else {
            messageDiv.classList.add("admin-message");
        }

        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (chatContainer.style.display === "none" && type === "admin") {
            unreadCount++;
            chatBadge.textContent = unreadCount;
        }
    }

    function botReply(userMessage) {
        let msg = userMessage.toLowerCase();
        let reply = "Sorry, I didn't understand that.Please contact support and explain your problem. 'click2web.2026@gmail.com'"
        
        if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
            reply = "Hey voter 👋 How can I help you today?";
        }
        else if (msg.includes("vote")) {
            reply = "To vote, go to the dashboard and click 'Start voting'.";
        }
        else if (msg.includes("result")) {
            reply = "Results will be available after voting ends.";
        }
        else if (msg.includes("login")) {
            reply = "Please use your registered username and password to login.";
        }
        else if (msg.includes("thanks")) {
            reply = "You're welcome 😊";
        }

        addMessage(reply, "admin");
    }

});