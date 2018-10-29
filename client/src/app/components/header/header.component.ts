import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material';
import { Router } from '@angular/router';

// Components
import { DialogComponent } from '../common/dialog/dialog.component';
import { PopupSigninComponent } from '../home/popup-signin/popup-signin.component';

// Services
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  signinDialog: MatDialogRef<PopupSigninComponent, any>;
  signoutDialog: MatDialogRef<DialogComponent, any>;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private authenticationService: AuthenticationService) { }

  ngOnInit() {
    
  }

  /**
   * Open the signin popup dialog
   */
  openSigninDialog(): void {
    this.signinDialog = this.dialog.open(PopupSigninComponent, {
      width: '550px',
      panelClass: "dialog"
    })

    this.signinDialog.afterClosed().subscribe((res) => {
      if (res) {
        this.router.navigate(this.authenticationService.homePage);
      }
    });
  }

  /**
   * Open the signout popup dialog
   */
  openSignoutDialog(): void {
    this.signoutDialog = this.dialog.open(DialogComponent, {
      width: '300px',
      panelClass: "dialog",
      data: {
        title: 'Déconnexion',
        body: 'Merci de confirmer la déconnexion.'
      }
    })

    this.signoutDialog.afterClosed().subscribe((res) => {
      if (res) {
        this.authenticationService.signout().subscribe(
          res => {
            this.router.navigate(this.authenticationService.homePage);
          }
        )
      }
    });
  }

  /**
   * To know if we are logged in or not or not
   */
  isConnected() {
    return this.authenticationService.isConnected;
  }
}
