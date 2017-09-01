"""
 -------------------------------------------------------------------------
 AIOpening - envs/base.py
 
 Defines the base Env class for environments.
 Comes also with an openAI Env adapter class.
  
 created: 2017/09/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""


from .env_spec import EnvSpec
import collections
from cached_property import cached_property


class Env(object):
    def step(self, action):
        """
        Run one time step of the environment's dynamics. When the end of an episode is reached, reset() should be called to reset the environment's
        internal state.

        :param any action: the action to be executed by the environment
        :return: Tuple of (observation, reward, done, info)
        observation (any): agent's observation of the current environment
        reward (float): amount of reward due to the previous action
        done (bool): a boolean, indicating whether the episode has ended
        info (dict): a dictionary containing other diagnostic information from the previous action
        """
        raise NotImplementedError

    def reset(self):
        """
        Resets the state of the environment, returning an initial observation.

        :return: the initial observation of the space (initial reward is assumed to be 0)
        :rtype: any
        """
        raise NotImplementedError

    @property
    def action_space(self):
        """

        :return: The action Space object
        :rtype: aiopening.spaces.Space
        """
        raise NotImplementedError

    @property
    def observation_space(self):
        """
        :return: The observation Space object
        :rtype: aiopening.spaces.Space
        """
        raise NotImplementedError

    # Helpers that derive from Spaces
    @property
    def action_dim(self):
        return self.action_space.flat_dim

    def render(self):
        pass

    def log_diagnostics(self, paths):
        """
        Log extra information per iteration based on the collected paths
        """
        pass

    @cached_property
    def spec(self):
        return EnvSpec(observation_space=self.observation_space, action_space=self.action_space)

    @property
    def horizon(self):
        """
        Horizon of the environment, if it has one
        """
        raise NotImplementedError


    def terminate(self):
        """
        Clean up operation,
        """
        pass

    def get_param_values(self):
        return None

    def set_param_values(self, params):
        pass


class Step(collections.namedtuple("Step", ["observation", "reward", "done", "info"])):
    def __init__(self, observation, reward, done, info):
        super().__init__(observation=observation, reward=reward, done=done, info=info)

