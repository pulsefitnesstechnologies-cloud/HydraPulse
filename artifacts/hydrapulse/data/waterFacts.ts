export interface WaterFact {
  id: number;
  fact: string;
  category: "Body" | "Brain" | "Performance" | "Science" | "Habit";
}

export const WATER_FACTS: WaterFact[] = [
  // ── Original 32 ──────────────────────────────────────────────────────────
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

  // ── Body effects ─────────────────────────────────────────────────────────
  { id: 33, category: "Body",        fact: "Bones are about 31% water. Hydration supports bone density and helps the body absorb calcium more efficiently." },
  { id: 34, category: "Body",        fact: "Your body uses water to regulate core temperature. When you're hot, sweat evaporates from the skin and carries heat away — a process called evaporative cooling." },
  { id: 35, category: "Body",        fact: "The stomach lining is protected from its own acid by a layer of mucus that is 98% water. Dehydration can weaken this barrier." },
  { id: 36, category: "Body",        fact: "Intervertebral discs — the shock absorbers between your vertebrae — are up to 88% water when healthy. Poor hydration contributes to disc compression and back pain." },
  { id: 37, category: "Body",        fact: "Adequate water intake lowers blood viscosity, reducing strain on your heart and decreasing the risk of blood clots." },
  { id: 38, category: "Body",        fact: "Your nails and hair both grow faster and stronger when you're well-hydrated. Water is essential for keratin synthesis." },
  { id: 39, category: "Body",        fact: "Water acts as a natural appetite suppressant — the hypothalamus sometimes confuses thirst and hunger, causing you to eat when you actually need water." },
  { id: 40, category: "Body",        fact: "The inner ear, which controls balance and spatial orientation, contains fluid that is almost entirely water. Dehydration can cause dizziness and vertigo." },
  { id: 41, category: "Body",        fact: "Saliva production drops significantly when dehydrated, making it harder to chew, swallow, and begin digesting food properly." },
  { id: 42, category: "Body",        fact: "Water is the primary solvent for all biochemical reactions in the human body. Without it, no enzyme, hormone, or signaling molecule can function correctly." },
  { id: 43, category: "Body",        fact: "During pregnancy, a woman's blood volume increases by up to 50%, requiring significantly higher water intake to support both mother and fetus." },
  { id: 44, category: "Body",        fact: "Chronic dehydration can cause the kidneys to conserve water by producing darker, more concentrated urine — a sign your intake needs to increase." },
  { id: 45, category: "Body",        fact: "Water is required to metabolize fat. Without enough water, lipolysis (fat breakdown) slows, making weight management harder." },
  { id: 46, category: "Body",        fact: "The human body generates heat from cellular metabolism. Water is the main medium for distributing and dissipating that heat throughout the body." },
  { id: 47, category: "Body",        fact: "Dehydration as low as 1% can reduce aerobic capacity, slow reaction time, and impair fine motor coordination." },

  // ── Brain & Mental Health ─────────────────────────────────────────────────
  { id: 48, category: "Brain",       fact: "The cerebrospinal fluid that surrounds and cushions your brain and spinal cord is produced from filtered blood plasma — and is almost entirely water." },
  { id: 49, category: "Brain",       fact: "Even resting, the brain uses about 20% of your body's energy — and it depends on a steady supply of water to maintain electrical signal transmission." },
  { id: 50, category: "Brain",       fact: "Research shows that drinking water before a cognitive test improves scores on tasks involving mental arithmetic and reaction speed." },
  { id: 51, category: "Brain",       fact: "Mild dehydration has been linked to reduced working memory capacity — the mental workspace you use for tasks like mental math or following directions." },
  { id: 52, category: "Brain",       fact: "Good hydration supports the blood-brain barrier, which protects the brain from pathogens and toxins circulating in the bloodstream." },
  { id: 53, category: "Brain",       fact: "Dehydration can disrupt serotonin production, which affects mood, sleep, and appetite regulation." },
  { id: 54, category: "Brain",       fact: "The hypothalamus — the brain region that regulates thirst — also controls sleep, body temperature, hunger, and emotional responses." },

  // ── Performance & Exercise ────────────────────────────────────────────────
  { id: 55, category: "Performance", fact: "Sweat is not just water — it contains electrolytes like sodium, potassium, and magnesium. Long or intense workouts may require electrolyte replacement as well." },
  { id: 56, category: "Performance", fact: "Pre-hydrating (drinking 500 ml 1–2 hours before exercise) can meaningfully delay fatigue and improve endurance." },
  { id: 57, category: "Performance", fact: "Grip strength measurably decreases when you are dehydrated. Hydration is relevant even to tasks requiring fine motor force, not just cardio endurance." },
  { id: 58, category: "Performance", fact: "In hot weather, your body can divert blood from working muscles to the skin for cooling purposes. Staying hydrated delays this trade-off." },
  { id: 59, category: "Performance", fact: "Post-exercise, you need to drink roughly 1.5x the fluid you lost to sweat to fully restore hydration — because some of what you drink goes to other processes." },
  { id: 60, category: "Performance", fact: "Heart rate rises 3–5 beats per minute for each 1% of body water lost during exercise, as the heart works harder to maintain output with lower blood volume." },
  { id: 61, category: "Performance", fact: "Dehydration reduces VO2 max — the maximum rate at which your body can use oxygen — by approximately 10% for every 2% of body water lost." },

  // ── Water Science & Earth ─────────────────────────────────────────────────
  { id: 62, category: "Science",     fact: "Earth's surface is about 71% water, yet only 3% of it is fresh water — and most of that is locked in glaciers and ice caps." },
  { id: 63, category: "Science",     fact: "Water is one of the few substances that expands when it freezes, which is why ice floats. This property is essential for life in cold climates." },
  { id: 64, category: "Science",     fact: "The water you drink today may have been part of a dinosaur, a cloud over ancient Rome, or a glacier in Antarctica. Water is continuously recycled through the hydrological cycle." },
  { id: 65, category: "Science",     fact: "A single glass of water can take decades — or centuries — to filter through layers of rock and soil to become groundwater, depending on the geology." },
  { id: 66, category: "Science",     fact: "Water has an unusually high surface tension compared to other liquids. This allows insects like water striders to walk on it and pulls water up through plant stems." },
  { id: 67, category: "Science",     fact: "The boiling point of water decreases with altitude. At the top of Everest, water boils at about 70°C (158°F) instead of 100°C." },
  { id: 68, category: "Science",     fact: "Sound travels about 4.3 times faster through water than through air, which is why submarines rely on sonar for underwater navigation." },
  { id: 69, category: "Science",     fact: "Water is called the 'universal solvent' because it dissolves more substances than any other liquid, including acids, salts, and many gases." },
  { id: 70, category: "Science",     fact: "Hot water can sometimes freeze faster than cold water under certain conditions — a counterintuitive phenomenon known as the Mpemba effect." },
  { id: 71, category: "Science",     fact: "At standard pressure, pure water freezes at exactly 0°C and boils at exactly 100°C — values that were used to define the original Celsius temperature scale." },
  { id: 72, category: "Science",     fact: "Seawater is denser than freshwater because of dissolved salts. This density difference drives deep ocean currents that regulate global climate." },
  { id: 73, category: "Science",     fact: "The oceans contain enough water to fill every stadium on Earth simultaneously — about 1.335 billion cubic kilometers in total." },
  { id: 74, category: "Science",     fact: "Water absorbs infrared radiation, making it a natural greenhouse gas. The water vapor in Earth's atmosphere traps more heat than carbon dioxide does." },
  { id: 75, category: "Science",     fact: "Liquid water is transparent to visible light but strongly absorbs longer wavelengths, which is why deep oceans appear dark blue or black." },

  // ── Habits & Hydration Tips ───────────────────────────────────────────────
  { id: 76, category: "Habit",       fact: "Eating fruits and vegetables contributes meaningfully to daily water intake. Cucumbers, lettuce, celery, and watermelon are over 90% water by weight." },
  { id: 77, category: "Habit",       fact: "Caffeinated drinks like coffee and tea do count toward daily fluid intake — the mild diuretic effect is smaller than the water you gain from drinking them." },
  { id: 78, category: "Habit",       fact: "Setting a phone reminder every 2 hours to take a few sips is one of the most effective strategies for people who regularly forget to drink water." },
  { id: 79, category: "Habit",       fact: "Sipping water throughout the day is more effective at maintaining hydration than consuming large amounts in one sitting, which the kidneys quickly excrete." },
  { id: 80, category: "Habit",       fact: "Pale yellow urine is the standard indicator of adequate hydration. Dark yellow or amber color typically means you need to drink more." },
  { id: 81, category: "Habit",       fact: "Older adults have a diminished sense of thirst, putting them at higher risk of dehydration. Scheduled drinking — not thirst — is the safer strategy." },
  { id: 82, category: "Habit",       fact: "Alcohol suppresses ADH (anti-diuretic hormone), causing increased urination and significant dehydration — a key contributor to the hangover effect." },
  { id: 83, category: "Habit",       fact: "Air travel dehydrates you faster than normal life. Cabin air humidity is typically 10–20%, far lower than the 40–60% most people are comfortable in." },
  { id: 84, category: "Habit",       fact: "A reusable water bottle with time markers (e.g. 'drink to here by noon') can improve daily intake by 40–50% compared to drinking without targets." },
  { id: 85, category: "Habit",       fact: "Adding a small amount of lemon, cucumber, or mint to water makes it measurably more appealing, leading to higher intake across the day." },
  { id: 86, category: "Habit",       fact: "Sparkling water hydrates just as effectively as still water. The carbonation has no measurable negative effect on hydration in healthy adults." },
  { id: 87, category: "Habit",       fact: "The classic '8 glasses a day' guideline is a rough estimate. Actual needs vary by body weight, climate, activity level, and diet." },
  { id: 88, category: "Habit",       fact: "Linking water intake to existing habits — like always drinking a glass when you make coffee — is a proven behavioral technique for building consistent hydration routines." },
  { id: 89, category: "Habit",       fact: "Cold water may aid weight management slightly by requiring the body to burn a small number of extra calories to warm it to body temperature." },
  { id: 90, category: "Habit",       fact: "Many people mistake hunger for thirst because both sensations originate in the hypothalamus. Drinking water before snacking is a simple way to check the real signal." },
];

export function getTodaysFact(): WaterFact {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return WATER_FACTS[dayOfYear % WATER_FACTS.length];
}
