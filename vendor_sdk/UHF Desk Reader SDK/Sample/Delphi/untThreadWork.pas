unit untThreadWork;

interface

uses
  System.SysUtils, System.Classes;

type
  TInventoryThread = class(TThread)
  private
    { Private declarations }
  protected
    procedure Execute; override;
  public
    procedure P_xy01;
  end;

implementation

{ TInventoryThread }

procedure TInventoryThread.Execute;
begin
  inherited;
  // ����������̴߳���
  P_xy01();
end;

procedure TInventoryThread.P_xy01;
begin

end;

end.

