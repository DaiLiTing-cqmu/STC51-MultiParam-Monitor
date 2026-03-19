#include "reg51.h"
#include "intrins.h"
//采集数据进入ADC模块，滤波再到单片机，WIFI模块
//在定时器中断触发时将采集到的数据通过串口发送出去，实现对多个ADC通道的循环采样。
//同时，还可以通过串口接收特定命令以控制定时器的启停。
//接收到的数据通过上位机生成图像
sfr     P0M1    =   0x93;
sfr     P0M0    =   0x94;
sfr     P1M1    =   0x91;
sfr     P1M0    =   0x92;
sfr     P2M1    =   0x95;
sfr     P2M0    =   0x96;
sfr     P3M1    =   0xb1;
sfr     P3M0    =   0xb2;
sfr     P4M1    =   0xb3;
sfr     P4M0    =   0xb4;
sfr     P5M1    =   0xc9;
sfr     P5M0    =   0xca;

sfr     T2L     =   0xd7;
sfr     T2H     =   0xd6;
sfr     AUXR    =   0x8e;
sfr     S2CON   =   0x9a;
sfr     S2BUF   =   0x9b;
sfr     IE2     =   0xaf;

sfr     IP2     =   0xb5;
sfr     IP2H    =   0xb6;

#define ES2         0x01

sfr     ADC_CONTR   =   0xbc;
sfr     ADC_RES     =   0xbd;
sfr     ADC_RESL    =   0xbe;
sfr     ADCCFG      =   0xde;
//引脚切换
sfr     P_SW1   =   0xa2;
sfr     P_SW2   =   0xba;
#define ADCTIM  (*(unsigned char volatile xdata *)0xfea8)

sbit    EADC    =   IE^5;	   

sfr    P5=0xC8;
sbit    P55     =   P5^5;
//sfr    AUXR=0x8e;	 

sbit    Lamp1     =   P1^2;
sbit    Lamp2     =   P1^3;
sbit    Lamp3     =   P1^4;
sbit    Buzz     =    P1^5;

unsigned int counter=0,adccounter=0;
unsigned int adcvalue=0,simadcvalue[4];
unsigned char adcbuf[10]={0xfa,1,2,3,4,5,6,7,8,0xfb};
unsigned char testadcbuf[10]={0xfa,1,2,3,4,5,6,7,8,0xfb};
unsigned char changroup[4]={11,12,13,14};
unsigned char chansel=0;
unsigned char i=0;
unsigned char IsCollecting=0;
unsigned char adcbuforder=0;
unsigned char U2TI=0;
unsigned int BuzzCounter=0;
/////////////////////////////////////////////////////////
void UART1_SENDBYTE(unsigned char Byte);
void UART2_SENDBYTE(unsigned char Byte);
void UART1_NotWaitSendByte(unsigned char Byte);
void ADC_Read(unsigned chansel);
///////////////////////////////////////////
void DealBuzz(void)
{
 if(BuzzCounter)
 {
  BuzzCounter++;  
  Buzz=1; 
  if(BuzzCounter>200) BuzzCounter=0;
 }else
 {
  	Buzz=0;
 }
}
//////////////////////////////////////////
void DealCollectData(void)
{
  if(IsCollecting==1)
  {
   	for(i=0;i<10;i++)
     {
        UART1_NotWaitSendByte(adcbuf[i]);
        UART2_SENDBYTE(adcbuf[i]);   
     }
    
    counter++;
    if(counter>500)
     {
      Lamp1=!Lamp1;  
      counter=0;
    }  
  }else if(IsCollecting==2)
  {
     for(i=0;i<4;i++)
	   {
	    simadcvalue[i]+=2*(i+1);
		if(simadcvalue[i]>1024)simadcvalue[i]=0;
		testadcbuf[2*i+1]=simadcvalue[i]/128;
		testadcbuf[2*i+2]=simadcvalue[i]%128;
	   }
   	for(i=0;i<10;i++)    
		  {	    
	
          UART1_NotWaitSendByte(testadcbuf[i]);
          UART2_SENDBYTE(testadcbuf[i]);   
         }     
    counter++;
    if(counter>250)
     {
      Lamp1=!Lamp1;  
      counter=0;
    }  
  }
  else
  {
   Lamp1=0;
  }

}
////////////////////////////////////////////////
void timer0_deal(void)	interrupt 1 
{
  TH0=0xd4;
  TL0=0xcd;	
  for(i=0;i<4;i++)ADC_Read(i);  
  DealCollectData();
  DealBuzz();
}
///////////////////////////////////////////////////////
//设置（控制）外部中断
void Int_UART1(void) interrupt 4 
{
	if(RI == 1)
	{	
  	if(SBUF==0xa5) {IsCollecting=1;BuzzCounter=1;UART1_SENDBYTE(0xfd);}
	else if(SBUF==0xa6) {IsCollecting=0;BuzzCounter=1;UART1_SENDBYTE(0xfe);EADC = 0;}
	else if(SBUF==0xa7) {IsCollecting=2;BuzzCounter=1;UART1_SENDBYTE(0xf1);EADC = 0;}
	RI=0; 
	}
}
//////////////////////////////////

void Int_UART2(void) interrupt 8 
{
//	if(S2CON&2)//TI
//	{ 
   // S2CON&=0xfd; 
//	U2TI=1;  
//	}
   if(S2CON&1) //RI
   {   
    S2CON&=0xfe;
    if(S2BUF==0xa5) {IsCollecting=1;BuzzCounter=1;UART2_SENDBYTE(0xfd);}
    else if(S2BUF==0xa6) {IsCollecting=0;BuzzCounter=1;UART2_SENDBYTE(0xfe);EADC = 0;}
	else if(S2BUF==0xa7) {IsCollecting=2;BuzzCounter=1;UART1_SENDBYTE(0xf1);EADC = 0;}
	Lamp3=!Lamp3;	
   }
}
//////////////////////////////////////////////////////////////////////////
//发送数据判断TI，接收数据判断RI
void UART1_SendByte(unsigned char Byte)
{
	SBUF=Byte;
	while(TI==0);//如果TI为0，即SBUF没有接收完数据，反复接收，接收完成后硬件自动置为1，需要软件清零
	TI=0;							      
}
////////////////////////////////////////////////////////////////////////////////////
void UART1_NotWaitSendByte(unsigned char Byte)//NotWait
{
    TI=0;
	SBUF=Byte;								      
}
////////////////////////////////////////////////////////////////////////////////////
void UART2_SendByte(unsigned char Byte)
{

	U2TI=0;
	S2BUF=Byte;
//	S2CON&=0xfd;
    IE2 &= 0xfe;
	while(U2TI==0)
	{
	 U2TI=S2CON&2;
	}//如果TI2为0，即SBUF没有接收完数据，反复接收，接收完成后硬件自动置为1，需要软件清零
	S2CON&=0xfd;
	IE2 |= 0x01;							      
}
/////////////////////////////////////////////////////////////////////////
void ADCEnalbePower(void)
{  
  ADCTIM = 0x3f; 	                          //设置ADC内部时序
  ADCCFG = 0x2f;                              //设置ADC时钟为系统时钟/2/16
  ADC_CONTR=0x80;                             //使能ADC模块
}
//////////////////////////////////////////////////////////////////////////////
void ADC_Read(unsigned chansel)
{   
	Lamp2=!Lamp2;     
  //EA = 1;
    ADC_CONTR |= 0x40+changroup[chansel];//0x40,表示第11道   
    _nop_();
    _nop_();
	_nop_();
	while(!(ADC_CONTR &0x20));
    ADC_CONTR &=~0x20;                                	 //清中断标志
   // adcbuf[0]=ADC_RES; 
   adcbuforder=chansel*2+1;
   adcvalue=ADC_RES*256+ADC_RESL;
   adcbuf[adcbuforder++]=adcvalue/128;  
   adcbuf[adcbuforder]=adcvalue%128;                        //读取ADC结果	   
}
//////////////////////////////////////
//定时器0
void timer0_Intital(void) 
{  
  	AUXR |= 0x80;			//定时器时钟1T模式
	TMOD &= 0xF0;			//设置定时器模式
	TL0 = 0xCD;				//设置定时初始值
	TH0 = 0xD4;				//设置定时初始值
	TF0 = 0;				//清除TF0标志
	ET0=1;
	TR0 = 1;				//定时器0开始计时
	EA = 1; 

}
/////////////////////////////////////////////////////////// 
   
//串行口定时器，设置定时器T1，选用方式2，自动装初值
void UART1_Intital()
{
    SCON = 0x50;		//8位数据,可变波特率
	AUXR |= 0x01;		//串口1选择定时器2为波特率发生器
	AUXR |= 0x04;		//定时器时钟1T模式
	T2L = 0xE8;			//设置定时初始值
	T2H = 0xFF;			//设置定时初始值
	AUXR |= 0x10;		//定时器2开始计时
	ES = 1;				//使能串口1中断	 
//	EA=1;	 
	}
//主函数中主要进行各种端口、定时器和ADC的配置，并启动相关中断，然后进入无限循环等待中断发生。
//////////////////////////////////////////////////////////////////////////
void UART2_Intital(void)	//115200bps@11.0592MHz
{ 
 //   S2CON = 0x10;
    IP2|=0x1;
	IP2H|=0x1;

	S2CON = 0x10;		//8位数据,可变波特率
	AUXR |= 0x04;		//定时器时钟1T模式
	T2L = 0xE8;			//设置定时初始值
	T2H = 0xFF;			//设置定时初始值
	AUXR |= 0x10;		//定时器2开始计时
    IE2 |= 0x01;		//使能串口2中断
        
}
///////////////////////////////////////////////////////////////////////////////////
void delay(unsigned int m)
{
 while(m--);
}
///////////////////////////////////////////////////////////////////////////////////
void main()
{
    P_SW2|=0x80;
	P_SW2&=0xfe;  
	P_SW1=0; 
	 
	
	P1M0=0X3c;
	P1M1=0X0;

    P3M0 = 0x00; 
    P3M1 = 0x78;  
	    
	Buzz=1;
	Lamp1=0;
	Lamp2=0;
	Lamp3=0;

	UART1_Intital();  
	UART2_Intital();

	ADCEnalbePower(); 
   	delay(50000);


	delay(50000);
	delay(50000);

	delay(50000);

	timer0_Intital();	

	Buzz=0;


	while(1)
	{	 
	//UART_SENDBYTE(0x26);
	}
}


