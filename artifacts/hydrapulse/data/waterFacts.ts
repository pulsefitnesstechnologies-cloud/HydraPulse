export interface WaterFact {
  id: number;
  fact: string;
  category: "Body" | "Brain" | "Performance" | "Science" | "Habit";
}

export const WATER_FACTS: WaterFact[] = [
  { id: 1,  category: "Brain",       fact: "Your brain is about 75% water. Even mild dehydration of 1–2% can impair concentration, memory, and mood." },
  { id: 2,  category: "Body",        fact: "Blood is roughly 90% water. It transports oxygen, nutrients, and waste products to every cell in your body." },
  { id: 3,  category: "Science",     fact: "The average adult loses about 2.5 liters of water per day through breathing, sweating, and digestion — even at rest." },
  { id: 4,  category: "Performance", fact: "A 2% drop in body water can reduce physical performance by up to 20% and cause measurable fatigue." },
  { id: 5,  category: "Body",        fact: "Your kidneys filter about 200 liters of blood every day and need adequate water to flush out waste as urine." },
  { id: 6,  category: "Brain",       fact: "Drinking water can boost your resting metabolic rate by up to 30% within 10 minutes of consumption." },
  { id: 7,  category: "Science",     fact: "Water is the only substance on Earth that naturally exists in all three states — solid, liquid, and gas — at normal temperatures." },
  { id: 8,  category: "Body",        fact: "Your skin is about 64% water. Proper hydration reduces the appearance of wrinkles and supports the skin barrier." },
  { id: 9,  category: "Performance", fact: "Staying hydrated helps lubricate your joints. Cartilage — the cushion between your bones — is 80% water." },
  { id: 10, category: "Habit",       fact: "Thirst is a late signal — by the time you feel thirsty, you may already be mildly dehydrated. Regular sips beat waiting for thirst." },
  { id: 11, category: "Body",        fact: "Your heart pumps about 2,000 gallons of blood per day, and needs water to maintain proper blood volume and pressure." },
  { id: 12, category: "Brain",       fact: "Dehydration increases cortisol (the stress hormone), which can make everyday challenges feel harder than they are." },
  { id: 13, category: "Science",     fact: "Water has an unusually high heat capacity, which is why it is so effective at regulating your body temperature through sweat." },
  { id: 14, category: "Performance", fact: "Athletes can lose over 1 liter of sweat per hour during intense exercise. Replacing it within the same hour is key to sustained performance." },
  { id: 15, category: "Body",        fact: "Your lungs lose about 400 ml of water per day just through breathing — more on cold or dry days." },
  { id: 16, category: "Habit",       fact: "Drinking a glass of water before each meal can help control appetite and naturally reduce caloric intake." },
  { id: 17, category: "Brain",       fact: "Water helps produce neurotransmitters and hormones. Chronic dehydration has been linked to increased risk of depression and anxiety." },
  { id: 18, category: "Science",     fact: "The human body can survive weeks without food but only 3–5 days without water, depending on temperature and activity level." },
  { id: 19, category: "Body",        fact: "Proper hydration supports your immune system by helping lymph — the fluid that carries white blood cells — move through your body." },
  { id: 20, category: "Performance", fact: "Drinking water before bed can reduce the risk of overnight muscle cramps and improve sleep quality by supporting cellular repair." },
  { id: 21, category: "Habit",       fact: "Room-temperature water is absorbed by your body slightly faster than ice-cold water, which can cause mild gastric contraction." },
  { id: 22, category: "Brain",       fact: "Studies show children who drink more water score significantly higher on attention and memory tests than those who are mildly dehydrated." },
  { id: 23, category: "Science",     fact: "Each water molecule is made of two hydrogen atoms bonded to one oxygen atom — a structure that gives water its unique polarity and solvent properties." },
  { id: 24, category: "Body",        fact: "Your digestive system needs water to produce saliva and digestive juices. Chronic dehydration is a leading cause of constipation." },
  { id: 25, category: "Performance", fact: "HRV (heart rate variability) — one of the metrics HydraPulse tracks — is directly influenced by hydration status. Better hydrated = higher HRV." },
  { id: 26, category: "Habit",       fact: "Keeping a water bottle in sight increases your likelihood of drinking it by up to 80%, according to behavioral studies." },
  { id: 27, category: "Body",        fact: "Your eyes are about 98% water. Dehydration is a common cause of dry, itchy, or tired-feeling eyes." },
  { id: 28, category: "Brain",       fact: "Headaches are one of the first signs of dehydration. Many tension headaches can be resolved simply by drinking 1–2 glasses of water." },
  { id: 29, category: "Science",     fact: "Water molecules move in and out of cells through tiny protein channels called aquaporins — discovered in 1992 and awarded the Nobel Prize in Chemistry in 2003." },
  { id: 30, category: "Performance", fact: "Well-hydrated muscles recover faster after exercise because water helps flush out lactic acid and transport nutrients into muscle tissue." },
  { id: 31, category: "Habit",       fact: "Starting your morning with a glass of water rehydrates your body after 7–8 hours without intake and kick-starts your metabolism." },
  { id: 32, category: "Body",        fact: "Your liver processes toxins with the help of water. Adequate hydration supports optimal liver function and detoxification." },
];

export function getTodaysFact(): WaterFact {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return WATER_FACTS[dayOfYear % WATER_FACTS.length];
}
