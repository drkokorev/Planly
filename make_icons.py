# Генерирует иконки Planly (без внешних зависимостей, кроме Pillow).
from PIL import Image, ImageDraw

BG=(11,11,12,255); LINE=(84,84,90,255); BLUE=(10,124,255,255); WHITE=(255,255,255,255)

def draw(size, pad_ratio=0.0, rounded=True, bg=BG):
    S=1024
    im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.2237),fill=bg)
    else: d.rectangle([0,0,S-1,S-1],fill=bg)
    k=1.0-pad_ratio*2
    def R(x,y,w,h,c,r):
        x=S*(pad_ratio+x*k); y=S*(pad_ratio+y*k); w=S*w*k; h=S*h*k; r=S*r*k
        d.rounded_rectangle([x,y,x+w,y+h],radius=r,fill=c)
    R(0.255,0.235,0.022,0.53,LINE,0.011)          # временная шкала
    R(0.355,0.255,0.40,0.145,WHITE,0.052)          # блок 1
    R(0.355,0.445,0.29,0.115,BLUE,0.042)           # блок 2
    R(0.355,0.605,0.36,0.16,(120,120,128,120),0.052)  # блок 3
    return im.resize((size,size),Image.LANCZOS)

for s in (192,512,1024):
    draw(s, rounded=True).save('icons/icon-%d.png'%s)
# apple-touch-icon: сплошной квадрат без прозрачности — маску iOS накладывает сам
draw(180, rounded=False).convert('RGB').save('icons/icon-180.png')
draw(512,pad_ratio=0.11,rounded=False,bg=BG).save('icons/icon-maskable-512.png')
print('icons ready')
