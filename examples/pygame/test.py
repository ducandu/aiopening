import pygame as pg
clock = pg.time.Clock()
d = pg.display.set_mode((600, 400))

sprite = pg.sprite.Sprite()
sprite.image = pg.image.load("simple_2d_platformer/images/erik.png").convert_alpha()
sprite.rect = sprite.image.get_rect()

offset_x = 0
offset_y = 0

while True:
	dt = clock.tick(1)

	d.fill(pg.Color("#ffaaaa"))
	pg.display.update()

	offset_x += 100
	offset_y += 100
	d.blit(sprite.image, (sprite.rect.x + offset_x, sprite.rect.y + offset_y), area=pg.Rect((0,0), (32, 32)))
	events = pg.event.get(pg.KEYDOWN)

	pg.display.update()

	for e in events:
		if e.key == pg.K_q:
			quit()
	
	