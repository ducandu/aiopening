"""
 -------------------------------------------------------------------------
 AIOpening - grid_world_vpg
 
 An example of a parallelized policy gradient method (A3C) run on a simple
 grid world MDP
  
 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

#TODO:from aiopening.labs import Lab
import aiopening as ai
from aiopening.envs.grid_world import GridWorld
from aiopening.algorithms import A3C

# create our lab to run RL experiments in
lab = ai.Lab()

# generate the environment, we would like to learn
env = GridWorld("8x8")

# generate an algorithm that should solve this env
algo = A3C()

# create an experiment

#model =