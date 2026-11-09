# How to get Driftwood and play it

This page does one thing: it walks you through getting the game onto your computer and
opening it. Follow the steps in order, top to bottom. You do not need to know anything
about GitHub, or about computers, to do this.

**What you need:** a Windows computer, about 10 minutes, and a web browser
(Chrome, Edge or Firefox — whichever you normally use).

---

## Step 1 — Download the game

1. Near the top of this page there is a green button that says **Code**. Click it.
2. A small menu drops down. Click **Download ZIP** at the bottom of it.
3. A file called `PookieGame2-main.zip` now downloads. Normally you will see it appear
   in the top-right of your browser, or in your **Downloads** folder. Wait for it to
   finish downloading.

---

## Step 2 — Unzip it

The game arrives squashed into one file and has to be opened out. Do not skip this step.

1. Open your **Downloads** folder.
2. Find the file called `PookieGame2-main.zip`. **Right-click** it.
3. In the menu that appears, click **Extract All…**
4. A small window opens showing a place to put the game. Click the **Extract** button.
5. A new folder called `PookieGame2-main` appears. **The game is inside this folder** —
   keep the folder where it is. If you delete it, the game is gone.

---

## Step 3 — Install Python (one time only)

The game uses a free helper program called **Python** to open itself. You only ever have
to install it once, and then never think about it again.

1. In your browser's address bar (the long box at the top where website addresses go),
   type **python.org/downloads** and press **Enter**.
2. On that page, click the big yellow button that says **Download Python 3**. (Any
   version starting with 3 is fine.)
3. A file downloads. Open it — it will be called something like `python-3.13.0-amd64.exe`.
4. A setup window opens. **Before clicking anything else, look at the very bottom of that
   first window for a small tick box that says "Add python.exe to PATH". Click it so it
   has a tick in it.** This is the one step people miss, and the game will not start
   without it.
5. Now click **Install Now** and wait.
6. When it finishes, it says "Setup was successful". Click **Close**.

---

## Step 4 — Start the game

1. Open the `PookieGame2-main` folder you made in Step 2.
2. Inside it you will see a file called **run** (its full name may show as `run.bat`).
   **Double-click it.**
3. A small black window appears and then hides itself down in your taskbar. That is
   normal — it is the game running quietly in the background. Leave it alone.
4. After a few seconds, your web browser opens the game on its own. Click **Single
   player** and you are in.

**If the game's page does not open by itself:** wait 5 seconds, open your browser, type
this into the address bar and press Enter:

```
127.0.0.1:8123
```

---

## Step 5 — Stopping the game

1. Close the game's browser tab.
2. On your taskbar, find the small black window called **"Driftwood server"**, click it,
   and close it with the **X**.

You can start the game again any time by repeating Step 4. You do not need to do Steps
1, 2 or 3 again.

---

## If something goes wrong

**A blue box says "Windows protected your PC".**
Click **More info**, then click **Run anyway**. This appears because the file came from
the internet, not because anything is wrong.

**A black window flashes open and disappears, and nothing else happens.**
Python is not installed the way the game needs. Do Step 3 again, and this time be sure
to tick **"Add python.exe to PATH"** before clicking Install Now. If you already
installed Python, run the installer again, choose **Modify**, and tick that box.

**The page says "can't reach this page" or "127.0.0.1 refused to connect".**
The little black window got closed. Start again at Step 4.

**The black window says "Python 3 is required and was not found".**
Same cause — Python is missing or was installed without the tick box. Redo Step 3.

**Nothing happens at all when you double-click run.**
Check that you unzipped the game (Step 2). If you are still looking inside a `.zip`
file, the game cannot start. Also check you are double-clicking **run**, not one of the
other files.

**It worked yesterday and now it does not.**
Start again at Step 4. Nothing you do in the game is lost as long as you used the game's
own Save menu.

---

## The controls

- **Move:** W, A, S, D
- **Look around:** move your mouse
- **Do things with your hands** (swing an axe, cast the rod, cook, eat): **left-click**
  and hold where holding is needed
- **Pick up:** X
- **Put down / place:** B
- **Crafting menu:** Y
- **Change what you are holding:** Q and E
- **Sprint:** hold Shift
- **Settings and saving:** Esc

### Two people on one keyboard

Player one uses the mouse and the keys above. Player two moves with the **arrow keys**
and uses the keys beside them:

- **Jump / respawn:** `Enter`
- **Use** (swing, cast, cook, eat): hold `/`
- **Pick up:** `.` &nbsp;·&nbsp; **Put down:** `,`
- **Crafting menu:** `;`
- **Change what you are holding:** `[` and `]`
- **Sprint:** hold the right `Shift`
- **Settings:** `-`
- **Saving and the game menu:** `\`
- **Fire-lighting and cooking mini-games:** alternate `/` and `'`

The **Settings** option on the title screen, and the in-game **Settings → Volume**
screen, share the same audio controls: **Sound effects** and **Music** levels, the
**Song** that is playing (left/right switches between *Beginning* and *Haggstrom*),
and a **Shuffle** switch that picks each next song at random. Both players share all
of it, so either panel can change what everyone hears.

The game can also be played by two people on one screen, and it works with controllers.
Both of those choices are offered on the first screen after you click play.
