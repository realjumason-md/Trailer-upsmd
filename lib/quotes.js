/**
 * GANGSTER QUOTES — for auto-bio rotation
 */

export const quotes = [
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
  "Through every dark night, there's a bright day after that. — 2Pac",
  "I don't see myself being special; I just see myself having more responsibilities than the next man. — 2Pac",
  "I want to grow. I want to be better. You Grow. We all grow. We're made to grow. — 2Pac",
  "Pay no mind to those who talk behind your back — it simply means you are two steps ahead. — 2Pac",
  "Death is not the greatest loss in life. The greatest loss is what dies inside while still alive. — 2Pac",
  "If you can make it through the night, there's a brighter day. — 2Pac",
  "Watch for phonies, keep your mind on your money, stay real. — 2Pac",
  "They got money for war but can't feed the poor. — 2Pac",

  // King Von
  "I never switched up. The streets know where I'm from. — King Von",
  "Stay down until you come up. That's the code. — King Von",
  "They took the ones I love so now I move in silence. — King Von",
  "Loyalty ain't for sale. You either got it or you don't. — King Von",
  "Real recognize real. Fake ones always reveal themselves eventually. — King Von",
  "I came from the mud so the dirt don't scare me. — King Von",
  "Pain made me who I am. I wouldn't change nothing. — King Von",
  "Trust no man fully. Not even yourself on a bad day. — King Von",
  "I survived for a reason. Don't waste what God saved you for. — King Von",
  "From the trenches, built with pressure. That's a diamond mentality. — King Von",

  // General
  "Keep your friends close and your enemies closer.",
  "A lion doesn't concern himself with the opinion of sheep.",
  "Either you run the day or the day runs you. — Jim Rohn",
  "The wolf on the hill is not as hungry as the wolf climbing the hill.",
  "Only the strong survive. The weak get weeded out by design.",
  "Move in silence. Only speak when it's time to say checkmate.",
  "If they don't know your dreams, they can't shoot them down.",
  "I'd rather walk alone than with a crowd going in the wrong direction.",
  "Pressure bursts pipes but it also makes diamonds. Know which one you are.",
  "The grind don't stop just because the night does.",
  "Never fold. Never switch up. Never forget where you came from.",
  "My circle is small. My trust is even smaller.",
  "Forgive but never forget. Move smart, not emotional.",
  "The ones watching you fail are the same ones who wanted you to.",
  "Built different from the ground up. That ain't luck — that's sacrifice.",
  "They fear what they can't control and they can't control me.",
];

export function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function getQuoteByIndex(index) {
  return quotes[index % quotes.length];
}
