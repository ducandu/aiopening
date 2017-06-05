<img src="https://github.com/sven1977/aiopener/blob/master/logo.png" width="50">

# aiopener
<b>opening up AI - unleash the fury :)</b>

aiopener is a Python library for games and reinforcement learning (RL) algorithms with focus on deep-neural-nets and deep-RL.
Games are defined as simple tmx files and each level of the game can be interpreted as a single MDP (see RL) that needs to be solved. aiopener comes with it's own 2D game engine ("spygame") written against Pygame.
There will also be an MDP-solver-server (to solve the levels of different games) and a command line client, through which one can upload game/levels/MDPs to the server for MDP-solver jobs.

## who should use aiopener?
<b>Answer</b>: people who ...
- are interested in RL algorithm research
- would like to test their ideas on simple 2D game environments (MDPs), which you can create using only a tiled map (tmx file)
- would like to have the aiopener server try different algorithms and hyperparameters automatically on given MDPs and return the best solutions

## the game engine (spygame)
<b>Usage</b>:

```
pip install aiopener
```

`maze_runner.py`
```
import aiopener.spygame as spyg

# create the GameManager
game_manager = spyg.GameManager([
    # level 1
    {"class": MazeRunnerLevel,  # <- this class needs to be defined somewhere
     "name" : "MAZE", # -> will read maze.tmx file and turn into Level object
     "id": 1,  
     },
], title="The Maze Runner - An A-Maze-ing Game :D", max_fps=60)

# that's it, play one of the levels -> this will enter an endless game loop
game_manager.levels_by_name["MAZE"].play()
```
