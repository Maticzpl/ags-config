{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, astal, ags }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    packages.${system} = {
        # astal = astal.packages.${system}.default;
        # ags = ags.packages.${system}.default;
        default = ags.lib.bundle {
            inherit pkgs;
            src = ./.;
            name = "custom-widgets"; # name of executable
            entry = "app.ts";
            gtk4 = false;

            # additional libraries and executables to add to gjs' runtime
            extraPackages = [
                astal.packages.${system}.io
                astal.packages.${system}.hyprland
                astal.packages.${system}.bluetooth
                astal.packages.${system}.battery
                astal.packages.${system}.mpris
                astal.packages.${system}.network
                astal.packages.${system}.tray
                astal.packages.${system}.apps
            # pkgs.fzf
            ];
        };
    };
  };
}
