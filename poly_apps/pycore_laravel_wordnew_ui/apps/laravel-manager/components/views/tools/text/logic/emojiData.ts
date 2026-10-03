/** Emoji catalog: compact "emoji keywords" entries per category with search helpers. */
export const EMOJI_CATEGORIES = ['smileys', 'people', 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'] as const;
export type EmojiCategory = (typeof EMOJI_CATEGORIES)[number];

export interface EmojiEntry {
  emoji: string;
  keywords: string;
  category: EmojiCategory;
}

const RAW: Record<EmojiCategory, string> = {
  smileys: [
    '😀 grinning happy smile', '😃 smiley happy joy', '😄 smile happy laugh', '😁 beaming grin teeth', '😆 laughing squint', '😅 sweat smile relief nervous',
    '🤣 rofl rolling laugh funny', '😂 tears of joy laugh funny', '🙂 slight smile', '🙃 upside down silly', '😉 wink flirt', '😊 blush smile happy',
    '😇 angel halo innocent', '🥰 love hearts adore', '😍 heart eyes love', '🤩 star struck wow', '😘 kiss blow love', '😗 kissing', '😚 kissing closed eyes',
    '😋 yum delicious tasty', '😛 tongue playful', '😜 wink tongue crazy', '🤪 zany goofy wild', '😝 squint tongue', '🤑 money mouth rich', '🤗 hug hugging warm',
    '🤭 giggle hand over mouth oops', '🤫 shush quiet secret', '🤔 thinking hmm ponder', '🤐 zipper mouth secret', '🤨 raised eyebrow skeptical', '😐 neutral meh',
    '😑 expressionless blank', '😶 no mouth silent', '😏 smirk sly', '😒 unamused annoyed', '🙄 eye roll whatever', '😬 grimace awkward', '😮‍💨 exhale relief sigh',
    '🤥 lying pinocchio', '😌 relieved calm peaceful', '😔 pensive sad', '😪 sleepy tired', '🤤 drool', '😴 sleeping zzz sleep', '😷 mask sick medical',
    '🤒 thermometer sick fever', '🤕 bandage hurt injured', '🤢 nauseated sick green', '🤮 vomit sick', '🤧 sneeze cold', '🥵 hot overheated', '🥶 cold freezing',
    '🥴 woozy dizzy drunk', '😵 dizzy knocked out', '🤯 mind blown exploding head', '🤠 cowboy hat yeehaw', '🥳 party celebrate birthday', '😎 cool sunglasses',
    '🤓 nerd glasses geek', '🧐 monocle curious', '😕 confused', '😟 worried', '🙁 frown sad', '😮 open mouth surprise', '😲 astonished shocked', '😳 flushed embarrassed',
    '🥺 pleading puppy eyes please', '😦 frowning anguish', '😨 fearful scared', '😰 anxious sweat', '😥 sad relieved', '😢 crying tear sad', '😭 sobbing loudly crying',
    '😱 scream fear horror', '😖 confounded', '😣 persevering', '😞 disappointed', '😓 downcast sweat', '😩 weary tired', '😫 tired exhausted', '🥱 yawn bored sleepy',
    '😤 triumph steam huff', '😡 pouting angry red mad', '😠 angry mad', '🤬 cursing swearing symbols', '😈 smiling devil imp', '👿 angry devil', '💀 skull dead',
    '☠️ skull crossbones danger', '💩 poop', '🤡 clown', '👻 ghost halloween', '👽 alien ufo', '🤖 robot bot', '😺 cat smile', '😸 cat grin', '😹 cat tears joy', '😻 cat heart eyes',
  ].join('\n'),
  people: [
    '👋 wave hello hi goodbye', '🤚 raised back of hand', '🖐️ hand fingers splayed', '✋ raised hand stop high five', '🖖 vulcan salute spock', '👌 ok perfect fine',
    '🤌 pinched fingers italian', '🤏 pinching small tiny', '✌️ victory peace', '🤞 crossed fingers luck hope', '🤟 love you gesture', '🤘 rock on horns', '🤙 call me shaka',
    '👈 point left', '👉 point right', '👆 point up', '👇 point down', '☝️ index pointing up', '👍 thumbs up like approve yes', '👎 thumbs down dislike no', '✊ raised fist power',
    '👊 fist bump punch', '🤛 left fist', '🤜 right fist', '👏 clap applause bravo', '🙌 raising hands celebrate praise', '👐 open hands', '🤲 palms up together', '🤝 handshake deal agreement',
    '🙏 pray thanks please folded hands', '✍️ writing hand', '💅 nail polish', '🤳 selfie', '💪 muscle strong flex biceps', '🦾 mechanical arm', '🦵 leg', '🦶 foot', '👂 ear listen',
    '👃 nose smell', '🧠 brain smart', '🫀 heart organ anatomical', '🦷 tooth', '👀 eyes look watching', '👁️ eye', '👅 tongue', '👄 mouth lips', '👶 baby', '🧒 child', '👦 boy', '👧 girl',
    '🧑 person adult', '👨 man', '👩 woman', '🧓 older person', '👴 old man', '👵 old woman', '🙍 frowning person', '🙎 pouting person', '🙅 no gesture', '🙆 ok gesture', '💁 information desk',
    '🙋 raising hand question', '🧏 deaf person', '🙇 bow sorry thank', '🤦 facepalm', '🤷 shrug dunno', '👮 police officer', '🕵️ detective spy', '💂 guard', '👷 construction worker',
    '🤴 prince', '👸 princess', '🧙 mage wizard magic', '🧚 fairy', '🧛 vampire', '🧟 zombie', '🧞 genie', '🧜 merperson', '🧑‍💻 technologist developer coder programmer', '🧑‍🔬 scientist',
    '🧑‍🎨 artist', '🧑‍🍳 cook chef', '🧑‍🏫 teacher', '🧑‍⚕️ health worker doctor', '🧑‍🚀 astronaut', '🧑‍🚒 firefighter', '🏃 running runner', '🚶 walking', '🧘 yoga meditation lotus', '🛀 bath',
  ].join('\n'),
  animals: [
    '🐶 dog face pet puppy', '🐱 cat face pet kitten', '🐭 mouse face', '🐹 hamster', '🐰 rabbit bunny', '🦊 fox', '🐻 bear', '🐼 panda', '🐨 koala', '🐯 tiger', '🦁 lion', '🐮 cow',
    '🐷 pig', '🐸 frog', '🐵 monkey face', '🙈 see no evil monkey', '🙉 hear no evil monkey', '🙊 speak no evil monkey', '🐔 chicken', '🐧 penguin', '🐦 bird', '🐤 baby chick',
    '🦆 duck', '🦅 eagle', '🦉 owl', '🦇 bat', '🐺 wolf', '🐗 boar', '🐴 horse face', '🦄 unicorn magic', '🐝 bee honeybee', '🐛 bug caterpillar', '🦋 butterfly', '🐌 snail slow',
    '🐞 ladybug beetle', '🐜 ant', '🦟 mosquito', '🪲 beetle', '🕷️ spider', '🦂 scorpion', '🐢 turtle slow', '🐍 snake python', '🦎 lizard', '🦖 t-rex dinosaur', '🦕 sauropod dinosaur',
    '🐙 octopus', '🦑 squid', '🦐 shrimp', '🦞 lobster', '🦀 crab', '🐡 blowfish', '🐠 tropical fish', '🐟 fish', '🐬 dolphin', '🐳 whale spouting', '🐋 whale', '🦈 shark', '🐊 crocodile',
    '🐅 tiger', '🐆 leopard', '🦓 zebra', '🦍 gorilla', '🐘 elephant', '🦛 hippo', '🦏 rhino', '🐪 camel', '🦒 giraffe', '🦘 kangaroo', '🐃 water buffalo', '🐂 ox', '🐄 cow',
    '🐎 horse', '🐖 pig', '🐑 sheep', '🦙 llama', '🐐 goat', '🦌 deer', '🐕 dog', '🐈 cat', '🐓 rooster', '🦃 turkey', '🦚 peacock', '🦜 parrot', '🦢 swan', '🕊️ dove peace', '🐇 rabbit',
    '🌵 cactus', '🎄 christmas tree', '🌲 evergreen tree', '🌳 deciduous tree', '🌴 palm tree', '🌱 seedling sprout plant', '🌿 herb leaf', '☘️ shamrock clover', '🍀 four leaf clover luck',
    '🍁 maple leaf autumn', '🍂 fallen leaf autumn', '🌸 cherry blossom spring', '🌹 rose flower love', '🌻 sunflower', '🌼 blossom daisy', '🌷 tulip', '🍄 mushroom',
  ].join('\n'),
  food: [
    '🍎 red apple fruit', '🍏 green apple fruit', '🍐 pear', '🍊 tangerine orange', '🍋 lemon', '🍌 banana', '🍉 watermelon', '🍇 grapes', '🍓 strawberry', '🫐 blueberries', '🍈 melon',
    '🍒 cherries', '🍑 peach', '🥭 mango', '🍍 pineapple', '🥥 coconut', '🥝 kiwi', '🍅 tomato', '🍆 eggplant aubergine', '🥑 avocado', '🥦 broccoli', '🥬 leafy green', '🥒 cucumber',
    '🌶️ hot pepper chili spicy', '🫑 bell pepper', '🌽 corn', '🥕 carrot', '🧄 garlic', '🧅 onion', '🥔 potato', '🍠 sweet potato', '🥐 croissant', '🥖 baguette bread', '🍞 bread loaf',
    '🥨 pretzel', '🧀 cheese', '🥚 egg', '🍳 cooking fried egg', '🥞 pancakes', '🧇 waffle', '🥓 bacon', '🥩 steak meat', '🍗 poultry leg chicken', '🍖 meat on bone', '🌭 hot dog',
    '🍔 hamburger burger', '🍟 french fries', '🍕 pizza italian', '🥪 sandwich', '🌮 taco mexican', '🌯 burrito', '🥗 green salad', '🍝 spaghetti pasta', '🍜 steaming bowl ramen noodles',
    '🍲 pot of food stew', '🍛 curry rice', '🍣 sushi japanese', '🍱 bento box', '🥟 dumpling', '🍤 fried shrimp tempura', '🍙 rice ball onigiri', '🍚 cooked rice', '🍘 rice cracker',
    '🍥 fish cake', '🥠 fortune cookie', '🍡 dango', '🍧 shaved ice', '🍨 ice cream', '🍦 soft ice cream', '🥧 pie', '🧁 cupcake', '🍰 shortcake cake slice', '🎂 birthday cake',
    '🍮 custard pudding flan', '🍭 lollipop candy', '🍬 candy sweet', '🍫 chocolate bar', '🍿 popcorn movie', '🍩 doughnut donut', '🍪 cookie', '🌰 chestnut', '🥜 peanuts',
    '🍯 honey pot', '🥛 glass of milk', '🍼 baby bottle', '☕ coffee hot beverage', '🍵 tea cup', '🧃 juice box', '🥤 cup with straw soda', '🍶 sake', '🍺 beer mug', '🍻 clinking beer mugs cheers',
    '🥂 clinking glasses champagne toast', '🍷 wine glass', '🥃 whisky tumbler', '🍸 cocktail glass', '🍹 tropical drink', '🧉 mate', '🧊 ice cube', '🥢 chopsticks', '🍴 fork and knife',
  ].join('\n'),
  travel: [
    '🚗 car automobile', '🚕 taxi', '🚙 suv', '🚌 bus', '🚎 trolleybus', '🏎️ racing car', '🚓 police car', '🚑 ambulance', '🚒 fire engine', '🚐 minibus', '🚚 delivery truck', '🚛 articulated lorry',
    '🚜 tractor', '🏍️ motorcycle', '🛵 motor scooter', '🚲 bicycle bike', '🛴 kick scooter', '🚂 locomotive steam train', '🚆 train', '🚄 high-speed train bullet', '🚇 metro subway', '🚊 tram',
    '✈️ airplane flight plane', '🛫 departure takeoff', '🛬 arrival landing', '🚁 helicopter', '🚀 rocket space launch', '🛸 flying saucer ufo', '🛰️ satellite', '⛵ sailboat', '🚤 speedboat',
    '🛥️ motor boat', '🚢 ship cruise', '⚓ anchor', '⛽ fuel pump gas', '🚧 construction', '🚦 vertical traffic light', '🚥 traffic light', '🗺️ world map', '🗿 moai statue', '🗽 statue of liberty',
    '🗼 tokyo tower', '🏰 castle', '🏯 japanese castle', '🏟️ stadium', '🎡 ferris wheel', '🎢 roller coaster', '🎠 carousel', '⛲ fountain', '⛱️ umbrella on ground beach', '🏖️ beach',
    '🏝️ desert island', '🏜️ desert', '🌋 volcano', '⛰️ mountain', '🏔️ snow capped mountain', '🏕️ camping', '🏠 house home', '🏡 house garden', '🏢 office building', '🏥 hospital', '🏦 bank',
    '🏨 hotel', '🏫 school', '🏭 factory', '⛪ church', '🕌 mosque', '🛕 hindu temple', '🌃 night with stars city', '🌆 cityscape dusk', '🌉 bridge at night', '🌅 sunrise', '🌄 sunrise over mountains',
    '🌍 globe europe africa earth world', '🌎 globe americas', '🌏 globe asia australia', '🌙 crescent moon night', '⭐ star', '🌟 glowing star', '☀️ sun sunny', '⛅ sun behind cloud', '☁️ cloud',
    '🌧️ rain cloud', '⛈️ thunderstorm', '🌩️ lightning cloud', '❄️ snowflake winter cold', '☃️ snowman', '🌈 rainbow', '🔥 fire hot flame', '💧 droplet water', '🌊 water wave ocean',
  ].join('\n'),
  activities: [
    '⚽ soccer ball football sport', '🏀 basketball', '🏈 american football', '⚾ baseball', '🎾 tennis', '🏐 volleyball', '🏉 rugby', '🎱 pool billiards 8 ball', '🏓 ping pong table tennis',
    '🏸 badminton', '🥅 goal net', '⛳ flag in hole golf', '🏹 bow and arrow archery', '🎣 fishing pole', '🥊 boxing glove', '🥋 martial arts uniform', '⛸️ ice skate', '🎿 skis', '🏂 snowboarder',
    '🏋️ weightlifting gym', '🤸 cartwheel gymnastics', '🏊 swimming swimmer', '🚴 biking cyclist', '🏆 trophy winner champion', '🥇 gold medal first', '🥈 silver medal second', '🥉 bronze medal third',
    '🏅 sports medal', '🎖️ military medal', '🎗️ reminder ribbon', '🎫 ticket', '🎟️ admission tickets', '🎪 circus tent', '🎭 performing arts theater masks', '🎨 artist palette art paint',
    '🎬 clapper board movie film', '🎤 microphone karaoke', '🎧 headphone music', '🎼 musical score', '🎹 musical keyboard piano', '🥁 drum', '🎷 saxophone', '🎺 trumpet', '🎸 guitar rock',
    '🎻 violin', '🎲 game die dice', '♟️ chess pawn', '🎯 direct hit bullseye target', '🎳 bowling', '🎮 video game controller gaming', '🕹️ joystick', '🧩 puzzle piece jigsaw',
    '🎉 party popper celebrate tada', '🎊 confetti ball', '🎈 balloon party', '🎁 wrapped gift present', '🎀 ribbon bow', '🎃 jack-o-lantern halloween pumpkin', '🎄 christmas tree holiday',
    '🎆 fireworks', '🎇 sparkler', '✨ sparkles shine magic', '🧨 firecracker',
  ].join('\n'),
  objects: [
    '⌚ watch time', '📱 mobile phone smartphone', '💻 laptop computer', '⌨️ keyboard', '🖥️ desktop computer', '🖨️ printer', '🖱️ computer mouse', '💽 computer disk', '💾 floppy disk save',
    '💿 optical disk cd', '📀 dvd', '📷 camera photo', '📹 video camera', '🎥 movie camera', '📺 television tv', '📻 radio', '⏰ alarm clock', '⏱️ stopwatch', '⏳ hourglass', '🔋 battery',
    '🔌 electric plug', '💡 light bulb idea', '🔦 flashlight', '🕯️ candle', '🧯 fire extinguisher', '💸 money with wings', '💵 dollar banknote cash', '💰 money bag', '💳 credit card payment',
    '💎 gem diamond', '⚖️ balance scale justice', '🔧 wrench tool', '🔨 hammer', '⚒️ hammer and pick', '🛠️ hammer and wrench tools', '⛏️ pick mining', '🔩 nut and bolt', '⚙️ gear settings',
    '🧱 brick', '🔗 link chain', '⛓️ chains', '🧰 toolbox', '🧲 magnet', '🔫 water pistol', '💣 bomb', '🔪 kitchen knife', '🛡️ shield protection', '🔮 crystal ball', '🧿 nazar amulet',
    '💊 pill medicine', '💉 syringe injection vaccine', '🩺 stethoscope', '🩹 adhesive bandage', '🧬 dna', '🔬 microscope science', '🔭 telescope', '📡 satellite antenna', '🧪 test tube chemistry',
    '🧹 broom cleaning', '🧺 basket laundry', '🧻 roll of paper toilet', '🚿 shower', '🛁 bathtub', '🔑 key', '🗝️ old key', '🚪 door', '🛏️ bed', '🛋️ couch', '🪑 chair',
    '📦 package box parcel', '📫 mailbox', '📬 mailbox with mail', '✉️ envelope email letter', '📧 e-mail', '📨 incoming envelope', '📝 memo note write', '📄 page document', '📑 bookmark tabs',
    '📊 bar chart statistics', '📈 chart increasing growth', '📉 chart decreasing decline', '📅 calendar date', '📌 pushpin', '📍 round pushpin location', '📎 paperclip attach', '✂️ scissors cut',
    '🗂️ card index dividers', '📁 file folder', '📂 open file folder', '🗑️ wastebasket trash delete', '🔒 locked lock secure', '🔓 unlocked', '🔏 lock with pen', '🔐 lock with key',
    '📚 books library', '📖 open book read', '📕 closed book', '🔖 bookmark', '🏷️ label tag', '✏️ pencil', '🖊️ pen', '🖌️ paintbrush', '🔍 magnifying glass search', '🔎 magnifying glass right',
  ].join('\n'),
  symbols: [
    '❤️ red heart love', '🧡 orange heart', '💛 yellow heart', '💚 green heart', '💙 blue heart', '💜 purple heart', '🖤 black heart', '🤍 white heart', '🤎 brown heart', '💔 broken heart',
    '❣️ heart exclamation', '💕 two hearts', '💞 revolving hearts', '💓 beating heart', '💗 growing heart', '💖 sparkling heart', '💘 heart with arrow cupid', '💝 heart with ribbon gift',
    '💯 hundred points perfect score', '💢 anger symbol', '💥 collision boom bang', '💫 dizzy star', '💦 sweat droplets splash', '💨 dashing away wind', '💬 speech balloon chat comment',
    '💭 thought balloon', '💤 zzz sleep', '✅ check mark button done yes', '✔️ check mark', '❌ cross mark no wrong', '❎ cross mark button', '❓ question mark red', '❔ question mark white',
    '❗ exclamation mark red warning', '❕ exclamation mark white', '‼️ double exclamation', '⁉️ exclamation question', '⚠️ warning caution', '🚫 prohibited forbidden no entry', '⛔ no entry',
    '🔞 no one under eighteen', '📵 no mobile phones', '🔔 bell notification', '🔕 bell with slash mute', '🔊 speaker loud volume', '🔇 muted speaker', '➕ plus add', '➖ minus subtract',
    '➗ divide division', '✖️ multiply', '♾️ infinity', '〰️ wavy dash', '➰ curly loop', '🔁 repeat loop', '🔂 repeat single', '🔀 shuffle', '▶️ play button', '⏸️ pause', '⏹️ stop', '⏺️ record',
    '⏭️ next track', '⏮️ previous track', '⏩ fast forward', '⏪ rewind', '🔼 up button', '🔽 down button', '⬆️ up arrow', '⬇️ down arrow', '⬅️ left arrow', '➡️ right arrow', '↗️ up right arrow',
    '↘️ down right arrow', '↩️ return arrow', '↪️ forward arrow', '🔄 counterclockwise arrows refresh reload', '🔃 clockwise arrows', '🔙 back arrow', '🔚 end arrow', '🔝 top arrow',
    '🔛 on arrow', '🆗 ok button', '🆕 new button', '🆒 cool button', '🆓 free button', '🆙 up button', '🆘 sos help', 'ℹ️ information', '🅰️ a button blood type', '🅱️ b button',
    '🟥 red square', '🟧 orange square', '🟨 yellow square', '🟩 green square', '🟦 blue square', '🟪 purple square', '⬛ black square', '⬜ white square', '🔴 red circle', '🟠 orange circle',
    '🟡 yellow circle', '🟢 green circle', '🔵 blue circle', '🟣 purple circle', '⚫ black circle', '⚪ white circle', '🔶 large orange diamond', '🔷 large blue diamond', '♻️ recycling symbol',
    '⚜️ fleur-de-lis', '🔱 trident', '☢️ radioactive', '☣️ biohazard', '☮️ peace symbol', '☯️ yin yang', '✝️ latin cross', '☪️ star and crescent', '©️ copyright', '®️ registered', '™️ trade mark',
    '#️⃣ keycap number sign hash', '*️⃣ keycap asterisk', '0️⃣ keycap zero', '1️⃣ keycap one', '2️⃣ keycap two', '3️⃣ keycap three',
  ].join('\n'),
  flags: [
    '🏁 chequered flag race finish', '🚩 triangular flag', '🎌 crossed flags', '🏴 black flag', '🏳️ white flag surrender', '🏳️‍🌈 rainbow flag pride', '🏴‍☠️ pirate flag',
    '🇺🇳 united nations', '🇪🇺 european union', '🇺🇸 united states usa america', '🇨🇦 canada', '🇲🇽 mexico', '🇧🇷 brazil', '🇦🇷 argentina', '🇨🇱 chile', '🇨🇴 colombia', '🇬🇧 united kingdom uk britain',
    '🇮🇪 ireland', '🇫🇷 france', '🇩🇪 germany', '🇪🇸 spain', '🇵🇹 portugal', '🇮🇹 italy', '🇳🇱 netherlands', '🇧🇪 belgium', '🇨🇭 switzerland', '🇦🇹 austria', '🇸🇪 sweden', '🇳🇴 norway',
    '🇩🇰 denmark', '🇫🇮 finland', '🇮🇸 iceland', '🇵🇱 poland', '🇨🇿 czechia czech republic', '🇭🇺 hungary', '🇷🇴 romania', '🇬🇷 greece', '🇹🇷 turkey', '🇺🇦 ukraine', '🇷🇺 russia',
    '🇮🇱 israel', '🇸🇦 saudi arabia', '🇦🇪 united arab emirates uae', '🇪🇬 egypt', '🇿🇦 south africa', '🇳🇬 nigeria', '🇰🇪 kenya', '🇮🇳 india', '🇵🇰 pakistan', '🇧🇩 bangladesh',
    '🇨🇳 china', '🇭🇰 hong kong', '🇹🇼 taiwan', '🇯🇵 japan', '🇰🇷 south korea korea', '🇸🇬 singapore', '🇲🇾 malaysia', '🇹🇭 thailand', '🇻🇳 vietnam', '🇮🇩 indonesia', '🇵🇭 philippines',
    '🇦🇺 australia', '🇳🇿 new zealand',
  ].join('\n'),
};

export const EMOJI_LIST: readonly EmojiEntry[] = EMOJI_CATEGORIES.flatMap((category) => RAW[category].split('\n').map((line) => {
  const space = line.indexOf(' ');
  return { emoji: line.slice(0, space), keywords: line.slice(space + 1), category };
}));

export const searchEmoji = (query: string, category: EmojiCategory | 'all'): EmojiEntry[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return EMOJI_LIST.filter((entry) => (category === 'all' || entry.category === category)
    && terms.every((term) => entry.keywords.includes(term) || entry.emoji === term));
};
