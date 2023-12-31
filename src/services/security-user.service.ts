import {/* inject, */ BindingScope, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {SecuritySpecs} from '../config/security.config';
import {
  AuthenticationFactor,
  Credentials,
  DataPqrs,
  RoleMenu,
  User,
} from '../models';
import {
  LoginRepository,
  RoleMenuRepository,
  UserRepository,
} from '../repositories';
const generator = require('generate-password');
const MD5 = require('crypto-js/md5');
const jwt = require('jsonwebtoken');

const fetch = require('node-fetch');

const FormData = require('form-data');

@injectable({scope: BindingScope.TRANSIENT})
export class SecurityUserService {
  constructor(
    @repository(UserRepository)
    public repositoryUser: UserRepository,
    @repository(LoginRepository)
    public repositoryLogin: LoginRepository,
    @repository(RoleMenuRepository)
    private repositoryRoleMenu: RoleMenuRepository,
  ) {}

  /**
   * Crear una clave aleatoria
   * @returns text aleatoria de n caracteres
   */
  createRandomText(n: number): string {
    let clave = generator.generate({
      length: n,
      numbers: true,
    });
    return clave;
  }

  /**
   *  cifrar una cadena con el algoritmo MD5
   * @param text texto a cifrar
   * @returns Cadena cifrada con MD5
   */

  encryptText(text: string): string {
    let encryptedText = MD5(text).toString();
    return encryptedText;
  }

  /**
   * Se busca un usuario con las credenciales dadas
   * @param credentials credenciales de usuario
   * @returns usuario si las credenciales son correctas, null de lo contrario
   */
  async identifyUser(credentials: Credentials): Promise<User | null> {
    let user = await this.repositoryUser.findOne({
      where: {
        email: credentials.email,
        password: credentials.password,
        validationStatus: true,
      },
    });
    return user;
  }

  /**
   * valida un codigo 2fa para un usuario
   * @param credential2fa credenciales de usuario con el codigo 2fa
   * @returns el registro de login si el codigo 2fa es correcto, null de lo contrario
   */
  async verifyCode2fa(
    credential2fa: AuthenticationFactor,
  ): Promise<User | null> {
    let login = await this.repositoryLogin.findOne({
      where: {
        userId: credential2fa.userId,
        code2Fa: credential2fa.code2Fa,
        codeStatus: false,
      },
    });
    if (login) {
      let user = await this.repositoryUser.findById(login.userId);
      return user;
    }
    return null;
  }

  /**
   * generacion de jwt
   * @param user información del usuario
   * @returns token
   */
  createToken(user: User): string {
    let data = {
      name: `${user.name} ${user.lastname}`,
      role: user.roleId,
      email: user.email,
    };
    let token = jwt.sign(data, SecuritySpecs.keyJWT);
    return token;
  }
  /**
   * Valida y obtiene el rol de un token
   * @param tk el token
   * @returns el _id del rol
   */
  getRolFromToken(tk: string): string {
    let obj = jwt.verify(tk, SecuritySpecs.keyJWT);
    return obj.role;
  }

  /**
   * Valida que el usuario exista para el envío de pqrs
   */
  async validateUser(data: DataPqrs): Promise<User | null> {
    let user = await this.repositoryUser.findOne({
      where: {
        email: data.email,
      },
    });
    return user;
  }

  /**
   * rerurns the permissions of a menu for a user
   * @param idRole id role to search
   */
  async getPermissionsFromMenuByUser(idRole: string): Promise<RoleMenu[]> {
    let menu: RoleMenu[] = await this.repositoryRoleMenu.find({
      where: {
        list: true,
        roleId: idRole,
      },
    });
    return menu;
  }

  /**
   * Create a user in the security microservice and send to the business microservice
   * @param data user data to create
   * @param url url to send the request
   * @returns the response of the request
   */

  async dataUser(data: any, url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'},
      });

      if (!response.ok) {
        // If the response is not OK, throw an error
        throw new Error(
          `Error trying the request: ${response.status} ${response.statusText}`,
        );
      }
      const jsonResponse = await response.json();
      console.log('User created in the business logic microservice');
      return jsonResponse; // Return the response data
    } catch (error) {
      console.error(
        'Error trying to create the user in the business logic microservice',
        error.message,
      );
      throw error;
    }
  }

  // Create a user in the security microservice and send to the business microservice with MySQL database
}
