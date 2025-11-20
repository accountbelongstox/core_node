# App Wuy HTML Pages Overview

This document describes the HTML mockups generated under this folder, their purposes, shared design choices, and how they interlink. All pages are mobile-first (max width ≈ 420px) and use inline CSS. Emojis are used for quick visual cues.

## Files and Purpose



- `login.html`  
  Login/Register form (phone + code), primary CTA to proceed to the map page. Extra link: ➡️ Register.

- `register.html`  
  Registration variant mirroring the login layout.

- `map.html`  
  Map mock background with a floating profile card showing relationship info and a link to friend details. Bottom navigation: Map / Friends / Mine.

- `friends-list.html`  
  Friends list with search bar and per-item “monitoring” toggle (advanced CSS iOS-style switches). Each friend name links to Chat. Includes hover/press feedback and improved secondary text.

- `search-friend.html`  
  Find friends by phone number with a quick action to add via QR code. 🧾 Shows a visible QR-code placeholder image.

- `add-friend.html`  
  Input to add a friend’s phone number, plus a QR instruction line. 🧾 Shows a visible QR-code placeholder image.

- `chat.html`  
  Conversation timeline with left/right bubbles, timestamps, and a fixed input bar with send icon.

- `friend-info.html`  
  Profile detail with header background image, avatar, health badges (steps, temperature, heart rate, hydration), locations visited, and phone report cards. Quick links: ➡️ History Tracks, ➡️ Network Records.

- `history-tracks.html`  
  Travel tracks panel (distance and stop details) with a soft header background image.

- `network-records.html`  
  Phone network logs (mobile network/WiFi) with a soft header background image.

- `mine.html`  
  Personal center with gradient header, avatar, and two list items linking to personal info and about pages.

- `personal-info.html`  
  Profile fields (name, signature, gender, phone, birthday, address, email, ID). Fixed top “Back” chip linking to `mine.html`.

- `about.html`  
  App logo and list items like “Features” and “Version Updates”. Fixed top “Back” chip linking to `mine.html`.

## Navigation and Link Map



- Login ➡️ Map (CTA), Register (text link)
- Bottom Nav on all pages:
  - Map ➡️ `map.html`
  - Friends ➡️ `friends-list.html`
  - Mine ➡️ `mine.html`
- Friends List:
  - Friend name ➡️ `chat.html`
  - Toolbar ➡️ `search-friend.html`, `add-friend.html`
- Map Card:
  - Info ➡️ `friend-info.html`
- Friend Info:
  - Actions ➡️ `history-tracks.html`, `network-records.html`
- Mine:
  - Items ➡️ `personal-info.html`, `about.html`
- Personal Info / About:
  - Back chip ➡️ `mine.html`

Result: Every page is reachable indirectly from Index via login/register and through global bottom navigation or contextual links. ✅

## Design System (Inline CSS)

- 📱 Mobile-first layout: container max-width ≈ 420px, safe-area padding, consistent spacing.
- 🎨 Colors: primary blues (`#1677ff`/`#2388ff`), soft grays, improved contrast for secondary text.
- 🧊 Shadows: elevated cards/panels with soft shadows (`0 10px 24px rgba(0,0,0,.08~.12)`).
- 🧩 Rounding: unified rounded corners on buttons, cards, panels, and navigation.
- 🌁 Backgrounds:
  - Pages with header imagery use subtle overlay textures (radial gradients) to enhance depth.
  - Login/Register add gentle hero textures matching the provided mock style.
- 🔘 Buttons:
  - Primary buttons with gradient blue and a small “folded corner” accent (CSS triangle).
- ✏️ Inputs:
  - Focus states with border highlight and soft glow for accessibility and clarity.
- 🔀 Switches:
  - iOS-style switch component `.switch` available on all pages. Used in Friends List.

## QR Code Placeholder Policy

- Pages referencing QR actions (Search Friend, Add Friend) now display a visible QR-code placeholder image:  
  `https://dummyimage.com/200x200/ffffff/000.png&text=QR+Code`  
  This provides a clear visual cue for scanning flow in the mockups. 🧾

## External Dependencies

- Icons: Font Awesome via CDN  
  `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css`

- Images: placeholder images from public services (dummyimage/unsplash) to approximate mock visuals.

## Accessibility Notes

- Keyboard focus-visible styles on interactive controls (switches).
- Larger tap targets on navigation and switches.
- Improved color contrast for secondary text and button labels.

## How to Preview

- Open any `.html` file directly in a modern browser (Chrome/Edge/Safari).  
- Recommended viewport width: ~375–420 px for optimal mobile look; desktop will center the phone-width container.

## Further Beautification (applied or ready)

- 🪄 Soft card containers for QR sections and search forms.
- 🧪 Hover/press feedback on list rows.
- 🌀 Avatar glow and gentle borders.
- 💎 Bottom nav: translucent blur and active-state highlight.
- 🌤️ Header overlays for depth on image-backed pages.
- 🔧 Advanced CSS switch module prepared for reuse across pages.

If you want more refinements (e.g., themed colors or stronger textures), we can add Design Tokens and a light/dark theme switch.