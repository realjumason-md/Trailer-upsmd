const quotes = [
  // Pop Smoke
  "Woo! They scared of me cause I came from the bottom and now I'm at the top. — Pop Smoke",
  "Shoot for the stars, aim for the moon. If you miss, at least you'll be amongst the stars. — Pop Smoke",
  "Loyalty over royalty. Period. — Pop Smoke",
  "I used to have nothing. Now I got everything. Remember that. — Pop Smoke",
  "Stay humble, stay hungry. — Pop Smoke",
  "Every day I'm grinding for a better tomorrow. — Pop Smoke",
  "The ones who smile the most often hurt the most inside. — Pop Smoke",
  "I don't celebrate with people who didn't sacrifice with me. — Pop Smoke",
  "In a world full of followers, I chose to lead. — Pop Smoke",
  "Trust your process. Your time is coming. — Pop Smoke",
  "They didn't believe in me, so I made them watch me win. — Pop Smoke",
  "Never let them see you sweat. Never let them see you bleed. — Pop Smoke",
  "I came from nothing so everything feels like everything. — Pop Smoke",

  // 2Pac
  "Reality is wrong. Dreams are for real. — 2Pac",
  "During your life, never stop dreaming. No one can take away your dreams. — 2Pac",
  "I know it seems hard sometimes but remember one thing. Through every dark night, there's a bright day after that. — 2Pac",
  "You can spend minutes, hours, days, weeks, or even months over-analyzing a situation; trying to put the pieces together, justifying what could've, would've happened – or you can just leave the pieces on the floor and move the fuck on. — 2Pac",
  "I don't see myself being special; I just see myself having more responsibilities than the next man. — 2Pac",
  "Don't change on me. Don't extort me unless you intend to do it forever. — 2Pac",
  "I want to grow. I want to be better. You Grow. We all grow. We're made to grow. — 2Pac",
  "The only time I have problems is when I sleep. — 2Pac",
  "It's the game of life. Do I win or do I lose? One day they're gonna shut the game down. — 2Pac",
  "I am a hard person to love but when I love, I love really hard. — 2Pac",
  "Pay no mind to those who talk behind your back, it simply means that you are two steps ahead. — 2Pac",
  "Death is not the greatest loss in life. The greatest loss is what dies inside while still alive. Never surrender. — 2Pac",
  "If you can make it through the night, there's a brighter day. — 2Pac",
  "Behind every sweet smile, there is a bitter sadness that no one can ever see and feel. — 2Pac",
  "Watch for phonies, keep your mind on your money, stay real. — 2Pac",
  "They got money for war but can't feed the poor. — 2Pac",

  // King Von
  "I never switched up. The streets know where I'm from. — King Von",
  "Stay down until you come up. That's the code. — King Von",
  "On sight. No questions. That's how we move. — King Von",
  "They took the ones I love so now I move in silence. — King Von",
  "Loyalty ain't for sale. You either got it or you don't. — King Von",
  "Real recognize real. Fake ones always reveal themselves eventually. — King Von",
  "I came from the mud so the dirt don't scare me. — King Von",
  "Pain made me who I am. I wouldn't change nothing. — King Von",
  "Trust no man fully. Not even yourself on a bad day. — King Von",
  "I survived for a reason. Don't waste what God saved you for. — King Von",
  "They smiled in my face while plotting on me. Now I keep my circle small. — King Von",
  "From the trenches, built with pressure. That's a diamond mentality. — King Von",

  // General Gangster Quotes
  "Keep your friends close and your enemies closer. — Sun Tzu / The Godfather",
  "A lion doesn't concern himself with the opinion of sheep. — Game of Thrones",
  "Either you run the day or the day runs you. — Jim Rohn",
  "The wolf on the hill is not as hungry as the wolf climbing the hill.",
  "Only the strong survive. The weak get weeded out by design.",
  "Move in silence. Only speak when it's time to say checkmate.",
  "Drip or drown. Either you making waves or you getting swept away.",
  "If they don't know your dreams, they can't shoot them down.",
  "I'd rather walk alone than with a crowd going in the wrong direction.",
  "God gave me this gift. They gave me the motivation to use it.",
  "Pressure bursts pipes but it also makes diamonds. Know which one you are.",
  "The grind don't stop just because the night does.",
  "Never fold. Never switch up. Never forget where you came from.",
  "Street smarts over book smarts. Wisdom over degrees.",
  "Survive first. Then dominate.",
  "My circle is small. My trust is even smaller.",
  "Forgive but never forget. Move smart, not emotional.",
  "The ones watching you fail are the same ones who wanted you to.",
  "Built different from the ground up. That ain't luck — that's sacrifice.",
  "They fear what they can't control and they can't control me.",
];

// Get a random quote
function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// Get quote by index (for rotating)
function getQuoteByIndex(index) {
  return quotes[index % quotes.length];
}

module.exports = { quotes, getRandomQuote, getQuoteByIndex };
