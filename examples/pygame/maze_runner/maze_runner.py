"""
 -------------------------------------------------------------------------
 shine - 
 maze_runner
 
 A simple maze runner game example to test automatic option learning 
  
 created: 2017/06/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

from abc import ABCMeta
import pygame
import aiopener.spygame as spyg

debug_flags = (#spyg.DEBUG_RENDER_COLLISION_TILES |
               #spyg.DEBUG_DONT_RENDER_TILED_TILE_LAYERS |
               #spyg.DEBUG_RENDER_SPRITES_RECTS |
               #spyg.DEBUG_RENDER_SPRITES_BEFORE_EACH_TICK |
               #spyg.DEBUG_RENDER_SPRITES_BEFORE_COLLISION_DETECTION |
               #spyg.DEBUG_RENDER_ACTIVE_COLLISION_TILES
               0#spyg.DEBUG_ALL
               )


class MazeRunnerLevel(spyg.Level):
    def __init__(self, name: str = "maze", **kwargs):
        super().__init__(name, **kwargs)

        # hook to the Level's agent
        self.agent = None
        # overwrite empty keyboard inputs
        # arrows
        self.keyboard_inputs = spyg.KeyboardInputs([[pygame.K_UP, "up"], [pygame.K_DOWN, "down"], [pygame.K_LEFT, "left"], [pygame.K_RIGHT, "right"]])
        self.register_event("mastered", "aborted", "lost", "viking_reached_exit")

    def play(self):
        # define Level's Scene (default function that populates Stage with stuff from tmx file)
        scene = spyg.Scene.register_scene(self.name, options={"tmx_obj" : self.tmx_obj})

        # start level (stage the scene; will overwrite the old 0-stage (=main-stage))
        # - the options-object below will be also stored in [Stage object].options
        stage = spyg.Stage.stage_scene(scene, 0, {"screen_obj": self, "components": [spyg.Viewport(self.display)],
                                                  "tile_layer_physics_collision_detector": spyg.AABBCollision.collide,
                                                  "tile_layer_physics_collision_handler": spyg.TopDownPhysics.tile_layer_physics_collision_handler
                                                  })

        # activate level triggers
        self.on_event("agent_reached_exit", register=True)

        # activate stage's escape menu
        # self.keyboard_inputs.on_event("key_down.esc", self, "escape_menu")

        # play a new GameLoop giving it some options
        spyg.GameLoop.play_a_loop(screen_obj=self, debug_rendering=True)

    def done(self):
        spyg.Stage.get_stage().stop()
        # switch off keyboard
        self.keyboard_inputs.update_keys()  # empty list -> no more keys

    # handles a character reaching the exit
    def agent_reached_exit(self):
        self.done()


class Agent(spyg.AnimatedSprite, metaclass=ABCMeta):
    """
    a generic Agent walking in the maze

    """

    def __init__(self, x: int, y: int, spritesheet: spyg.SpriteSheet):
        """
        Args:
            x (int): the start x position
            y (int): the start y position
            spritesheet (spyg.Spritesheet): the SpriteSheet object (tsx file) to use for this Viking
        """
        super().__init__(x, y, spritesheet, {
            "default"          : "stand",  # the default animation to play
            "stand"            : {"frames": [0], "loop": False, "flags": spyg.Animation.ANIM_PROHIBITS_STAND},
            "run"              : {"frames": [5, 6, 7, 8, 9, 10, 11, 12], "rate": 1 / 8},
        })

        self.handles_own_collisions = True
        self.type = spyg.Sprite.get_type("friendly")

        # add components to this Viking
        # loop time line:
        # - pre-tick: Brain (needs animation comp to check e.g., which commands are disabled), Physics (movement + collision resolution)
        # - tick: chose animation to play
        # - post-tick: Animation
        self.register_event("pre_tick", "post_tick", "collision")
        self.cmp_brain = self.add_component(spyg.Brain("brain", ["up", "down", "left", "right"]))
        self.cmp_physics = self.add_component(spyg.TopDownPhysics("physics"))

        # subscribe/register to some events
        self.register_event("bump.bottom", "bump.top", "bump.left", "bump.right")

    # - mainly determines agent's animation that gets played
    def tick(self, game_loop):
        dt = game_loop.dt

        # tell our subscribers (e.g. Components) that we are ticking
        self.trigger_event("pre_tick", game_loop)

        # moving in x/y direction?
        if self.cmp_physics.vx != 0 or self.cmp_physics.vy != 0:
            self.check_running()
        # not moving in any direction
        else:
            # just stand
            if self.allow_play_stand():
                self.play_animation("stand")

        self.trigger_event("post_tick", game_loop)

        return

    # player is running (called if x-speed != 0)
    def check_running(self):
        if self.cmp_brain.commands["left"] != self.cmp_brain.commands["right"]:  # xor
            self.play_animation("run")

    # check, whether it's ok to play 'stand' animation
    def allow_play_stand(self):
        anim_setup = spyg.Animation.get_settings(self.spritesheet.name, self.cmp_animation.animation)
        return not (anim_setup["flags"] & spyg.Animation.ANIM_PROHIBITS_STAND)


if __name__ == "__main__":
    # create a GameManager
    game_manager = spyg.GameManager([
        # the level
        {"class": MazeRunnerLevel,
         "name" : "MAZE", "id": 1,  # name is enough -> takes tmx file from 'data/'+[name.lower()]+'.tmx' and has default key-inputs
         },
    ], title="The Maze Runner - An A-Maze-ing Game :D", max_fps=60, debug_flags=debug_flags)

    # that's it, play one of the levels -> this will enter an endless game loop
    game_manager.levels_by_name["MAZE"].play()

