// CHECK LOGIN
let user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) {
    window.location.href = "index.html";
}

// PREVENT DOUBLE VOTING
if (user.voteCompleted) {
    alert("You have already cast your vote.");
    window.location.href = "user.html";
}

const cards = document.querySelectorAll(".candidate-card");
const confirmBtn = document.getElementById("confirmVote");
const message = document.getElementById("voteMessage");

let selectedParty = null;

// SELECT ONE PARTY
cards.forEach(card => {
    card.addEventListener("click", () => {

        cards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");

        card.querySelector("input").checked = true;
        selectedParty = card.getAttribute("data-party");
    });
});

// CONFIRM VOTE
confirmBtn.addEventListener("click", () => {

    if (!selectedParty) {
        message.style.color = "red";
        message.innerText = "Please select a party before confirming.";
        return;
    }

    // SAVE VOTE
    user.voteCompleted = true;
    user.selectedParty = selectedParty;

    localStorage.setItem("currentUser", JSON.stringify(user));

    message.style.color = "green";
    message.innerText = "✅ Vote successfully submitted!";

    setTimeout(() => {
        window.location.href = "user.html";
    }, 2000);
});