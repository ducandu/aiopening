"""
 -------------------------------------------------------------------------
 AIOpening - 
 grid_world
 
 !!TODO: add file description here!! 
  
 created: 2017/08/31 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

import numpy as np
from aiopening.envs import Env
import aiopening.spaces as spaces


class GridWorld(Env):
    """
    A classic grid world where the action space is up,down,left,right and the
    state space is:
    'S' : starting point
    'F' or '.': free space
    'W' or 'x': wall
    'H' or 'o': hole (terminates episode)
    'G' : goal
    """

    # all available maps
    MAPS = {
        "chain": [
            "GFFFFFFFFFFFFFSFFFFFFFFFFFFFG"
        ],
        "4x4_safe": [
            "SFFF",
            "FWFW",
            "FFFW",
            "WFFG"
        ],
        "4x4": [
            "SFFF",
            "FHFH",
            "FFFH",
            "HFFG"
        ],
        "8x8": [
            "SFFFFFFF",
            "FFFFFFFF",
            "FFFHFFFF",
            "FFFFFHFF",
            "FFFHFFFF",
            "FHHFFFHF",
            "FHFFHFHF",
            "FFFHFFFG"
        ],
    }

    def __init__(self, desc="4x4"):
        if isinstance(desc, str):
            desc = self.MAPS[desc]
        desc = np.array(list(map(list, desc)))
        desc[desc == '.'] = 'F'
        desc[desc == 'o'] = 'H'
        desc[desc == 'x'] = 'W'
        self.desc = desc
        self.n_row, self.n_col = desc.shape
        (start_x,), (start_y,) = np.nonzero(desc == 'S')
        self.start_state = start_x * self.n_col + start_y
        self.state = None
        self.domain_fig = None

    def reset(self):
        self.state = self.start_state
        return self.state

    def step(self, action):
        """
        action map:
        0: left
        1: down
        2: right
        3: up
        :param action: should be a one-hot vector encoding the action
        :return: tuple with s', r', is_done, info
        :rtype: tuple
        """
        possible_next_states = self.get_possible_next_states(self.state, action)

        # determine the next state based on the transition function
        probs = [x[1] for x in possible_next_states]
        next_state_idx = np.random.choice(len(probs), p=probs)
        next_state = possible_next_states[next_state_idx][0]

        next_x = next_state // self.n_col
        next_y = next_state % self.n_col

        # determine reward and done flag
        next_state_type = self.desc[next_x, next_y]
        if next_state_type == 'H':
            done = True
            reward = 0
        elif next_state_type in ['F', 'S']:
            done = False
            reward = 0
        elif next_state_type == 'G':
            done = True
            reward = 1
        else:
            raise NotImplementedError
        # set s'=s
        self.state = next_state

        # return tuple (s', r, done, info)
        return self.state, reward, done, {"state": self.state}

    def get_possible_next_states(self, state, action):
        """
        Given the state and action, return a list of possible next states and their probabilities. Only next states
        with nonzero probabilities will be returned
        For now: Implemented as a deterministic MDP

        :param state: start state
        :param action: action
        :return: a list of pairs (s', p(s'|s,a))
        """
        # assert self.observation_space.contains(state)
        # assert self.action_space.contains(action)

        x = state // self.n_col
        y = state % self.n_col
        coords = np.array([x, y])

        increments = np.array([[0, -1], [1, 0], [0, 1], [-1, 0]])
        next_coords = np.clip(
            coords + increments[action],
            [0, 0],
            [self.n_row - 1, self.n_col - 1]
        )
        next_state = next_coords[0] * self.n_col + next_coords[1]
        state_type = self.desc[x, y]
        next_state_type = self.desc[next_coords[0], next_coords[1]]
        if next_state_type == 'W' or state_type == 'H' or state_type == 'G':
            return [(state, 1.)]
        else:
            return [(next_state, 1.)]

    @property
    def action_space(self):
        return spaces.Discrete(4)

    @property
    def observation_space(self):
        return spaces.Discrete(self.n_row * self.n_col)

    @property
    def horizon(self):
        return None
